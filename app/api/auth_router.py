import datetime
import hashlib
import hmac
import re
import secrets
import time
from typing import Optional
from urllib.parse import urlencode

import jwt
import os
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.auth import get_current_user_id
from app.db.engine import SessionLocal
from app.db.models import LoginCode, User
from app.services.passwords import hash_password, verify_password
from app.services.users import (
    AuthConflict,
    claim_telegram,
    create_email_user,
    find_user_by_email,
    get_or_create_user,
    link_email_login,
)

router = APIRouter(prefix="/auth", tags=["auth"])

SECRET_KEY = os.getenv("JWT_SECRET", "dev-secret-change-in-prod")
BOT_TOKEN = os.getenv("BOT_TOKEN", "")
WEB_URL = os.getenv("WEB_URL", "http://localhost:3000")
ALGORITHM = "HS256"
TOKEN_EXPIRE_SECONDS = 60 * 60 * 24 * 180  # 180 дней — редкий перелогин (вход завязан на Telegram, который в РФ нестабилен)


class TelegramAuthData(BaseModel):
    id: int
    first_name: str
    last_name: Optional[str] = None
    username: Optional[str] = None
    photo_url: Optional[str] = None
    auth_date: int
    hash: str
    # Не входит в подпись Telegram — исключается в verify_telegram_auth.
    tz_offset_min: Optional[int] = None


def verify_telegram_auth(data: TelegramAuthData) -> bool:
    """Проверяем подпись от Телеграма."""
    check_hash = data.hash
    data_dict = data.model_dump(exclude={"hash", "tz_offset_min"})
    data_check_string = "\n".join(
        f"{k}={v}" for k, v in sorted(data_dict.items()) if v is not None
    )
    secret_key = hashlib.sha256(BOT_TOKEN.encode()).digest()
    computed_hash = hmac.new(
        secret_key, data_check_string.encode(), hashlib.sha256
    ).hexdigest()

    if computed_hash != check_hash:
        return False

    # Проверяем что данные не старше 24 часов
    if time.time() - data.auth_date > 86400:
        return False

    return True


def create_jwt_token(user_id: int, username: Optional[str] = None) -> str:
    payload = {
        "sub": str(user_id),
        "username": username,
        "exp": int(time.time()) + TOKEN_EXPIRE_SECONDS,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_jwt_token(token: str) -> dict:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])


@router.post("/telegram")
def telegram_auth(data: TelegramAuthData):
    if not verify_telegram_auth(data):
        raise HTTPException(status_code=401, detail="Неверная подпись Telegram")

    # Гарантируем запись о пользователе и обновляем профиль из виджета
    get_or_create_user(data.id, username=data.username)
    with SessionLocal() as session:
        user = session.get(User, data.id)
        if user is not None:
            if data.first_name:
                user.first_name = data.first_name[:64]
            if data.photo_url:
                user.photo_url = data.photo_url
            if data.tz_offset_min is not None:
                user.tz_offset_min = data.tz_offset_min
            session.commit()

    token = create_jwt_token(data.id, data.username)
    return {"access_token": token, "token_type": "bearer"}


@router.get("/telegram/login-url")
def telegram_login_url():
    """URL для входа через Telegram в один клик (redirect, без JS-виджета).

    Фронт по клику уводит пользователя на этот URL; после авторизации Telegram
    возвращает его на {WEB_URL}/login с подписанными данными, которые фронт
    отправляет в POST /auth/telegram. Домен WEB_URL должен быть прописан у бота
    через BotFather /setdomain.
    """
    bot_id = BOT_TOKEN.split(":", 1)[0] if BOT_TOKEN else ""
    params = {
        "bot_id": bot_id,
        "origin": WEB_URL,
        "request_access": "write",
        "return_to": f"{WEB_URL}/login",
    }
    return {"url": "https://oauth.telegram.org/auth?" + urlencode(params)}


def generate_login_code(telegram_id: int) -> str:
    """Создаём одноразовый код и сохраняем в БД."""
    code = secrets.token_hex(4).upper()  # 8 символов, например A3F9B21C
    with SessionLocal() as session:
        with session.begin():
            # Удаляем старые неиспользованные коды этого пользователя
            session.query(LoginCode).filter(
                LoginCode.telegram_id == telegram_id,
                LoginCode.used == False,
            ).delete()
            session.add(LoginCode(
                code=code,
                telegram_id=telegram_id,
                created_at=datetime.datetime.utcnow(),
                used=False,
            ))
    return code


class CodeAuthData(BaseModel):
    code: str


@router.post("/code")
def code_auth(data: CodeAuthData):
    """Авторизация по одноразовому коду от бота."""
    code = data.code.strip().upper()
    with SessionLocal() as session:
        with session.begin():
            entry = session.execute(
                select(LoginCode).where(
                    LoginCode.code == code,
                    LoginCode.used == False,
                )
            ).scalar_one_or_none()

            if not entry:
                raise HTTPException(status_code=401, detail="Неверный или устаревший код")

            # Проверяем что код не старше 5 минут
            age = (datetime.datetime.utcnow() - entry.created_at).total_seconds()
            if age > 300:
                raise HTTPException(status_code=401, detail="Код истёк")

            entry.used = True
            telegram_id = entry.telegram_id

    user = get_or_create_user(telegram_id)
    token = create_jwt_token(telegram_id, user.username)
    return {"access_token": token, "token_type": "bearer"}


# --- Email + пароль ---

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_MIN_PASSWORD_LEN = 8


class RegisterData(BaseModel):
    email: str
    password: str
    consent: bool = False


class LoginData(BaseModel):
    email: str
    password: str


@router.post("/register")
def register(data: RegisterData):
    email = data.email.strip().lower()
    if not _EMAIL_RE.match(email):
        raise HTTPException(status_code=422, detail={"code": "invalid_email", "message": "Некорректный email"})
    if len(data.password) < _MIN_PASSWORD_LEN:
        raise HTTPException(status_code=422, detail={"code": "weak_password", "message": "Пароль не короче 8 символов"})
    # Согласие на ПДн обязательно при создании аккаунта (фиксируем consented_at).
    if not data.consent:
        raise HTTPException(status_code=422, detail={"code": "consent_required", "message": "Требуется согласие на обработку персональных данных"})
    if find_user_by_email(email) is not None:
        raise HTTPException(status_code=409, detail={"code": "email_taken", "message": "Этот email уже зарегистрирован"})
    try:
        user = create_email_user(email, hash_password(data.password))
    except IntegrityError:
        # Гонка: email заняли между проверкой и вставкой.
        raise HTTPException(status_code=409, detail={"code": "email_taken", "message": "Этот email уже зарегистрирован"})
    token = create_jwt_token(user.id)
    return {"access_token": token, "token_type": "bearer"}


@router.post("/login")
def login(data: LoginData):
    user = find_user_by_email(data.email)
    if user is None:
        # Различаем «нет аккаунта» и «неверный пароль» — фронт подсказывает
        # зарегистрироваться (осознанный трейд-офф энумерации email ради UX).
        raise HTTPException(status_code=401, detail={"code": "account_not_found", "message": "Аккаунт не найден"})
    if not user.password_hash or not verify_password(user.password_hash, data.password):
        raise HTTPException(status_code=401, detail={"code": "wrong_password", "message": "Неверный пароль"})
    token = create_jwt_token(user.id, user.username)
    return {"access_token": token, "token_type": "bearer"}


# --- Привязка durable-входа к текущему аккаунту / перенос из бота ---


class LinkEmailData(BaseModel):
    email: str
    password: str
    consent: bool = False


@router.post("/link-email")
def link_email(data: LinkEmailData, user_id: int = Depends(get_current_user_id)):
    """Путь 2: добавить email+пароль к текущему аккаунту (для вошедших, напр.,
    через Telegram). Записи не двигаются — это тот же аккаунт."""
    email = data.email.strip().lower()
    if not _EMAIL_RE.match(email):
        raise HTTPException(status_code=422, detail={"code": "invalid_email", "message": "Некорректный email"})
    if len(data.password) < _MIN_PASSWORD_LEN:
        raise HTTPException(status_code=422, detail={"code": "weak_password", "message": "Пароль не короче 8 символов"})
    if not data.consent:
        raise HTTPException(status_code=422, detail={"code": "consent_required", "message": "Требуется согласие на обработку персональных данных"})
    try:
        link_email_login(user_id, email, hash_password(data.password))
    except AuthConflict as exc:
        raise HTTPException(status_code=409, detail={"code": exc.code, "message": exc.message})
    except IntegrityError:
        raise HTTPException(status_code=409, detail={"code": "email_taken", "message": "Этот email уже зарегистрирован"})
    return {"ok": True}


@router.post("/claim")
def claim(data: TelegramAuthData, user_id: int = Depends(get_current_user_id)):
    """Путь 1: перенести записи из бота. Подтверждение владения = подпись
    Telegram. Telegram-аккаунт становится главным → возвращаем новый токен."""
    if not verify_telegram_auth(data):
        raise HTTPException(status_code=401, detail="Неверная подпись Telegram")
    try:
        user = claim_telegram(user_id, data.id)
    except AuthConflict as exc:
        raise HTTPException(status_code=409, detail={"code": exc.code, "message": exc.message})
    token = create_jwt_token(user.id, user.username)
    return {"access_token": token, "token_type": "bearer"}

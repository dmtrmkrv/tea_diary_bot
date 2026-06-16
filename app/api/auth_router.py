import datetime
import hashlib
import hmac
import secrets
import time
from typing import Optional
from urllib.parse import urlencode

import jwt
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from app.db.engine import SessionLocal
from app.db.models import LoginCode, User
from app.services.users import get_or_create_user

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


def verify_telegram_auth(data: TelegramAuthData) -> bool:
    """Проверяем подпись от Телеграма."""
    check_hash = data.hash
    data_dict = data.model_dump(exclude={"hash"})
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

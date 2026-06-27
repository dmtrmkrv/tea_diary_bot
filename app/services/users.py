"""Утилиты для работы с пользователями."""

from __future__ import annotations

import datetime
from typing import Optional

from sqlalchemy import func, select, text

from app.db.engine import SessionLocal
from app.db.models import Tasting, TeaItem, Teaware, User

# Floor для web-id на SQLite (в проде id берём из sequence users_web_id_seq).
# 10^12 — выше любого telegram_id, чтобы пространства id не пересекались.
_WEB_ID_FLOOR = 1_000_000_000_000


def _normalize_username(username: Optional[str]) -> Optional[str]:
    if not username:
        return None
    cleaned = username.strip().lstrip("@")
    if not cleaned:
        return None
    return cleaned[:32]


def get_or_create_user(user_id: int, username: Optional[str] = None) -> User:
    """Гарантирует наличие записи о пользователе и возвращает её."""

    normalized_username = _normalize_username(username)

    with SessionLocal() as session:
        user = session.get(User, user_id)
        if user is None:
            # telegram_id = id: строка узнаётся как telegram-юзер и удовлетворяет
            # CHECK ck_users_identifier (PG) — иначе новый юзер не создастся.
            user = User(id=user_id, telegram_id=user_id, username=normalized_username)
            session.add(user)
            session.commit()
            session.refresh(user)
            return user

        if normalized_username is not None and user.username != normalized_username:
            user.username = normalized_username
            session.commit()
            session.refresh(user)
        return user


def set_user_timezone(user_id: int, offset_min: int) -> User:
    """Сохраняет часовой пояс пользователя, создавая запись при необходимости."""

    with SessionLocal() as session:
        user = session.get(User, user_id)
        if user is None:
            user = User(id=user_id, telegram_id=user_id, tz_offset_min=offset_min)
            session.add(user)
        else:
            user.tz_offset_min = offset_min
        session.commit()
        session.refresh(user)
        return user


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def find_user_by_email(email: str) -> Optional[User]:
    with SessionLocal() as session:
        return session.execute(
            select(User).where(User.email == _normalize_email(email))
        ).scalar_one_or_none()


def _next_web_user_id(session) -> int:
    """id для нового web-юзера. PG — из sequence; SQLite — max(id) с высоким floor."""
    bind = session.bind
    if bind is not None and bind.dialect.name == "postgresql":
        return session.execute(text("SELECT nextval('users_web_id_seq')")).scalar_one()
    max_id = session.execute(select(func.max(User.id))).scalar() or 0
    return max(max_id, _WEB_ID_FLOOR - 1) + 1


def create_email_user(
    email: str,
    password_hash: str,
    consented_at: Optional[datetime.datetime] = None,
) -> User:
    """Создаёт web-юзера с email+паролем. id — суррогат из sequence/floor."""
    with SessionLocal() as session:
        with session.begin():
            user = User(
                id=_next_web_user_id(session),
                email=_normalize_email(email),
                password_hash=password_hash,
                consented_at=consented_at or datetime.datetime.utcnow(),
            )
            session.add(user)
        session.refresh(user)
        return user


def find_user_by_yandex_id(yandex_id: str) -> Optional[User]:
    with SessionLocal() as session:
        return session.execute(
            select(User).where(User.yandex_id == yandex_id)
        ).scalar_one_or_none()


def create_yandex_user(
    yandex_id: str,
    email: Optional[str],
    first_name: Optional[str],
    consented_at: Optional[datetime.datetime] = None,
) -> User:
    """Создаёт web-юзера, вошедшего через Яндекс.

    email прицепляем, только если он ещё не занят другим аккаунтом (иначе
    оставляем пустым — yandex_id всё равно удовлетворяет CHECK ck_users_identifier).
    """
    with SessionLocal() as session:
        with session.begin():
            email_norm = _normalize_email(email) if email else None
            if email_norm is not None:
                taken = session.execute(
                    select(User.id).where(User.email == email_norm)
                ).first()
                if taken is not None:
                    email_norm = None  # чужую/занятую почту не цепляем
            user = User(
                id=_next_web_user_id(session),
                yandex_id=yandex_id,
                email=email_norm,
                first_name=(first_name[:64] if first_name else None),
                consented_at=consented_at or datetime.datetime.utcnow(),
            )
            session.add(user)
        session.refresh(user)
        return user


class AuthConflict(Exception):
    """Бизнес-конфликт при привязке/слиянии аккаунтов (роутер мапит в HTTP)."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def link_email_login(
    user_id: int,
    email: str,
    password_hash: str,
    consented_at: Optional[datetime.datetime] = None,
) -> User:
    """Путь 2: прицепить email+пароль к ТЕКУЩЕМУ аккаунту.

    Для тех, кто уже вошёл (например, через Telegram) и хочет durable-вход по
    почте — записи никуда не двигаются, это тот же аккаунт. Telegram-привязка и
    id остаются прежними.
    """
    norm = _normalize_email(email)
    with SessionLocal() as session:
        with session.begin():
            taken = session.execute(
                select(User.id).where(User.email == norm, User.id != user_id)
            ).first()
            if taken is not None:
                raise AuthConflict("email_taken", "Этот email уже зарегистрирован")
            user = session.get(User, user_id)
            if user is None:
                raise AuthConflict("account_not_found", "Аккаунт не найден")
            if user.email is not None and user.email != norm:
                raise AuthConflict(
                    "email_already_set", "К аккаунту уже привязана другая почта"
                )
            user.email = norm
            user.password_hash = password_hash
            if user.consented_at is None:
                user.consented_at = consented_at or datetime.datetime.utcnow()
        session.refresh(user)
        return user


def _move_user_records(session, src_id: int, dst_id: int) -> None:
    """Переносит все записи src → dst, продолжая нумерацию seq_no дегустаций.

    Фото и проливы цепляются к дегустациям (tasting_id) и переезжают вместе с
    ними. seq_no назначаем выше максимума у получателя, чтобы не нарушить
    уникальный индекс (user_id, seq_no).
    """
    dst_max = session.execute(
        select(func.max(Tasting.seq_no)).where(Tasting.user_id == dst_id)
    ).scalar() or 0
    src_tastings = (
        session.execute(
            select(Tasting).where(Tasting.user_id == src_id).order_by(Tasting.seq_no)
        )
        .scalars()
        .all()
    )
    for i, t in enumerate(src_tastings, start=1):
        t.user_id = dst_id
        t.seq_no = dst_max + i
    for model in (TeaItem, Teaware):
        for row in (
            session.execute(select(model).where(model.user_id == src_id))
            .scalars()
            .all()
        ):
            row.user_id = dst_id


def claim_telegram(current_user_id: int, telegram_id: int) -> User:
    """Путь 1: слить текущий (email/Яндекс) аккаунт в Telegram-аккаунт бота.

    Telegram-строка остаётся главной (её id напрямую использует бот), к ней
    прицепляются ключи текущего аккаунта, а его записи (если были) переносятся.
    Возвращает Telegram-аккаунт — фронту нужен новый токен sub=user.id.
    """
    with SessionLocal() as session:
        with session.begin():
            telegram_user = (
                session.execute(
                    select(User).where(
                        (User.id == telegram_id) | (User.telegram_id == telegram_id)
                    )
                )
                .scalars()
                .first()
            )
            if telegram_user is None:
                raise AuthConflict(
                    "no_bot_records", "Не нашли записей бота для этого Telegram"
                )
            current = session.get(User, current_user_id)
            if current is None:
                raise AuthConflict("account_not_found", "Аккаунт не найден")
            if telegram_user.id == current.id:
                raise AuthConflict(
                    "already_linked", "Этот Telegram уже привязан к вашему аккаунту"
                )
            # Telegram уже привязан к аккаунту с durable-входом (почта/Яндекс) —
            # это самостоятельный аккаунт. Повторный перенос в третий аккаунт
            # запрещаем: нужно войти в тот аккаунт, а не вливать его в новый.
            if telegram_user.email is not None or telegram_user.yandex_id is not None:
                raise AuthConflict(
                    "telegram_account_has_login",
                    "Этот Telegram уже привязан к другому аккаунту — войдите в него.",
                )

            # Снимаем ключи текущего аккаунта, чтобы перенести их на Telegram-строку.
            cur_email = current.email
            cur_password = current.password_hash
            cur_yandex = current.yandex_id
            cur_consent = current.consented_at

            # Переносим записи и УДАЛЯЕМ строку целиком (не обнуляем поля):
            # иначе на PG строка без единого идентификатора нарушает CHECK
            # ck_users_identifier. Удаление заодно освобождает уникальные
            # email/yandex для переноса на Telegram-строку.
            _move_user_records(session, src_id=current.id, dst_id=telegram_user.id)
            session.delete(current)
            session.flush()

            if cur_email and not telegram_user.email:
                telegram_user.email = cur_email
                telegram_user.password_hash = cur_password
            if cur_yandex and not telegram_user.yandex_id:
                telegram_user.yandex_id = cur_yandex
            if telegram_user.telegram_id is None:
                telegram_user.telegram_id = telegram_id
            if telegram_user.consented_at is None:
                telegram_user.consented_at = cur_consent or datetime.datetime.utcnow()
        session.refresh(telegram_user)
        return telegram_user

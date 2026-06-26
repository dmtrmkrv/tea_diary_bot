"""Утилиты для работы с пользователями."""

from __future__ import annotations

import datetime
from typing import Optional

from sqlalchemy import func, select, text

from app.db.engine import SessionLocal
from app.db.models import User

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
            user = User(id=user_id, username=normalized_username)
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
            user = User(id=user_id, tz_offset_min=offset_min)
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

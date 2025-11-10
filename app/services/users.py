"""Утилиты для работы с пользователями."""

from __future__ import annotations

from typing import Optional

from app.db.engine import SessionLocal
from app.db.models import User


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

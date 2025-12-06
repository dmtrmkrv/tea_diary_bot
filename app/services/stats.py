"""Сервис для получения статистики бота."""

from __future__ import annotations

import datetime
from dataclasses import dataclass

from sqlalchemy import func, select

from app.db.engine import SessionLocal
from app.db.models import Tasting, User


@dataclass
class BotStats:
    total_users: int
    total_tastings: int
    tastings_last_7d: int
    active_users_last_7d: int


async def get_bot_stats() -> BotStats:
    """Возвращает агрегированную статистику по пользователям и дегустациям."""

    now = datetime.datetime.utcnow()
    seven_days_ago = now - datetime.timedelta(days=7)

    with SessionLocal() as session:
        total_users = session.execute(select(func.count()).select_from(User)).scalar_one()
        total_tastings = session.execute(
            select(func.count()).select_from(Tasting)
        ).scalar_one()
        tastings_last_7d = session.execute(
            select(func.count()).where(Tasting.created_at >= seven_days_ago)
        ).scalar_one()
        active_users_last_7d = session.execute(
            select(func.count(func.distinct(Tasting.user_id))).where(
                Tasting.created_at >= seven_days_ago
            )
        ).scalar_one()

    return BotStats(
        total_users=total_users,
        total_tastings=total_tastings,
        tastings_last_7d=tastings_last_7d,
        active_users_last_7d=active_users_last_7d,
    )

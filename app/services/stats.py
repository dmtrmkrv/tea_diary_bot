"""Сервис для получения статистики бота."""

from __future__ import annotations

import datetime
from dataclasses import dataclass
from typing import List

from sqlalchemy import func, select

from app.db.engine import SessionLocal
from app.db.models import Tasting, User


@dataclass
class UserStats:
    total_tastings: int
    top_categories: List[str]
    average_rating: float


async def get_user_stats(user_id: int) -> UserStats:
    """Возвращает личную статистику пользователя."""

    with SessionLocal() as session:
        total_tastings = session.execute(
            select(func.count()).where(Tasting.user_id == user_id)
        ).scalar_one()

        top_rows = session.execute(
            select(Tasting.category, func.count().label("cnt"))
            .where(Tasting.user_id == user_id)
            .group_by(Tasting.category)
            .order_by(func.count().desc())
            .limit(3)
        ).all()
        top_categories = [row.category for row in top_rows]

        avg = session.execute(
            select(func.avg(Tasting.rating)).where(
                Tasting.user_id == user_id, Tasting.rating > 0
            )
        ).scalar_one()
        average_rating = round(float(avg), 1) if avg is not None else 0.0

    return UserStats(
        total_tastings=total_tastings,
        top_categories=top_categories,
        average_rating=average_rating,
    )


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

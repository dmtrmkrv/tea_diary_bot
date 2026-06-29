from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from app.api.deps import get_db
from app.api.auth import get_current_user_id
from app.db.models import User, Tasting, TeaItem, Teaware
from app.services.users import delete_user

router = APIRouter(prefix="/users", tags=["users"])

class UserOut(BaseModel):
    id: int
    username: Optional[str]
    first_name: Optional[str] = None
    photo_url: Optional[str] = None
    tz_offset_min: int
    # Какие способы входа привязаны — фронт по ним решает, что показать в профиле.
    email: Optional[str] = None
    has_telegram: bool = False
    has_yandex: bool = False
    has_password: bool = False
    class Config:
        from_attributes = True


def _user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        username=user.username,
        first_name=user.first_name,
        photo_url=user.photo_url,
        tz_offset_min=user.tz_offset_min,
        email=user.email,
        has_telegram=user.telegram_id is not None,
        has_yandex=user.yandex_id is not None,
        has_password=user.password_hash is not None,
    )


class UserStatsOut(BaseModel):
    tastings: int
    tea_items: int
    teaware: int
    top_categories: List[str]


class TzUpdate(BaseModel):
    tz_offset_min: int


class NameUpdate(BaseModel):
    name: str


@router.get("/me", response_model=UserOut)
def get_me(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Не найдено")
    return _user_out(user)


@router.get("/me/stats", response_model=UserStatsOut)
def get_my_stats(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    tastings = db.execute(
        select(func.count(Tasting.id)).where(Tasting.user_id == user_id)
    ).scalar_one()
    tea_items = db.execute(
        select(func.count(TeaItem.id)).where(TeaItem.user_id == user_id)
    ).scalar_one()
    teaware = db.execute(
        select(func.count(Teaware.id)).where(Teaware.user_id == user_id)
    ).scalar_one()

    top_rows = db.execute(
        select(Tasting.category, func.count().label("cnt"))
        .where(Tasting.user_id == user_id, Tasting.category != "")
        .group_by(Tasting.category)
        .order_by(func.count().desc())
        .limit(3)
    ).all()
    top_categories = [row.category for row in top_rows]

    return UserStatsOut(
        tastings=tastings,
        tea_items=tea_items,
        teaware=teaware,
        top_categories=top_categories,
    )


@router.patch("/me/tz", response_model=UserOut)
def update_my_tz(
    data: TzUpdate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    """Автоопределение часового пояса с веба: фронт шлёт UTC-сдвиг браузера."""
    if not -720 <= data.tz_offset_min <= 840:
        raise HTTPException(status_code=400, detail="Некорректный часовой пояс")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Не найдено")
    user.tz_offset_min = data.tz_offset_min
    db.commit()
    db.refresh(user)
    return _user_out(user)


@router.patch("/me/name", response_model=UserOut)
def update_my_name(
    data: NameUpdate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    """Инлайн-смена отображаемого имени. Пишем в first_name (профиль показывает
    его первым; username оставляем под telegram-хэндл)."""
    name = data.name.strip()
    if not 1 <= len(name) <= 64:
        raise HTTPException(status_code=422, detail={"code": "invalid_name", "message": "Имя должно быть от 1 до 64 символов"})
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Не найдено")
    user.first_name = name
    db.commit()
    db.refresh(user)
    return _user_out(user)


@router.delete("/me")
def delete_me(user_id: int = Depends(get_current_user_id)):
    """Полное удаление аккаунта (право на удаление, 152-ФЗ). Сносит все данные
    пользователя и файлы. После — фронт разлогинивает."""
    delete_user(user_id)
    return {"ok": True}

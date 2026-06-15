from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from app.api.deps import get_db
from app.api.auth import get_current_user_id
from app.db.models import User, Tasting, TeaItem, Teaware

router = APIRouter(prefix="/users", tags=["users"])

class UserOut(BaseModel):
    id: int
    username: Optional[str]
    first_name: Optional[str] = None
    photo_url: Optional[str] = None
    tz_offset_min: int
    class Config:
        from_attributes = True


class UserStatsOut(BaseModel):
    tastings: int
    tea_items: int
    teaware: int
    top_categories: List[str]


@router.get("/me", response_model=UserOut)
def get_me(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Не найдено")
    return user


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

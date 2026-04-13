from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import datetime

from app.api.deps import get_db
from app.api.auth import get_current_user_id
from app.db.models import TeaItem, Teaware
from app.services.storage import get_presigned_url

router = APIRouter(prefix="/collection", tags=["collection"])


# ---- Схемы ----

class TeaItemOut(BaseModel):
    id: int
    name: str
    category: Optional[str]
    year: Optional[int]
    region: Optional[str]
    vendor: Optional[str]
    notes: Optional[str]
    cover_url: Optional[str] = None
    created_at: datetime.datetime
    class Config:
        from_attributes = True


class TeaItemCreate(BaseModel):
    name: str
    category: Optional[str] = None
    year: Optional[int] = None
    region: Optional[str] = None
    vendor: Optional[str] = None
    notes: Optional[str] = None


class TeawareOut(BaseModel):
    id: int
    name: str
    type: Optional[str]
    volume_ml: Optional[int]
    material: Optional[str]
    notes: Optional[str]
    cover_url: Optional[str] = None
    created_at: datetime.datetime
    class Config:
        from_attributes = True


class TeawareCreate(BaseModel):
    name: str
    type: Optional[str] = None
    volume_ml: Optional[int] = None
    material: Optional[str] = None
    notes: Optional[str] = None


# ---- Чай ----

@router.get("/tea", response_model=List[TeaItemOut])
def list_tea(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    items = db.execute(
        select(TeaItem)
        .where(TeaItem.user_id == user_id)
        .order_by(TeaItem.created_at.desc())
    ).scalars().all()

    result = []
    for item in items:
        out = TeaItemOut.model_validate(item)
        if item.cover_object_key:
            try:
                out.cover_url = get_presigned_url(item.cover_object_key)
            except Exception:
                pass
        result.append(out)
    return result


@router.post("/tea", response_model=TeaItemOut)
def create_tea(
    data: TeaItemCreate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    item = TeaItem(
        user_id=user_id,
        created_at=datetime.datetime.utcnow(),
        **data.model_dump(),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return TeaItemOut.model_validate(item)


@router.delete("/tea/{item_id}")
def delete_tea(
    item_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    item = db.get(TeaItem, item_id)
    if not item or item.user_id != user_id:
        raise HTTPException(status_code=404, detail="Не найдено")
    db.delete(item)
    db.commit()
    return {"ok": True}


# ---- Посуда ----

@router.get("/teaware", response_model=List[TeawareOut])
def list_teaware(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    items = db.execute(
        select(Teaware)
        .where(Teaware.user_id == user_id)
        .order_by(Teaware.created_at.desc())
    ).scalars().all()

    result = []
    for item in items:
        out = TeawareOut.model_validate(item)
        if item.cover_object_key:
            try:
                out.cover_url = get_presigned_url(item.cover_object_key)
            except Exception:
                pass
        result.append(out)
    return result


@router.post("/teaware", response_model=TeawareOut)
def create_teaware(
    data: TeawareCreate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    item = Teaware(
        user_id=user_id,
        created_at=datetime.datetime.utcnow(),
        **data.model_dump(),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return TeawareOut.model_validate(item)


@router.delete("/teaware/{item_id}")
def delete_teaware(
    item_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    item = db.get(Teaware, item_id)
    if not item or item.user_id != user_id:
        raise HTTPException(status_code=404, detail="Не найдено")
    db.delete(item)
    db.commit()
    return {"ok": True}

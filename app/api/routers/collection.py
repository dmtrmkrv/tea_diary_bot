from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import datetime

from app.api.deps import get_db
from app.api.auth import get_current_user_id
from app.db.models import TeaItem, Teaware, Tasting, Photo
from app.services.storage import (
    get_presigned_url,
    save_tea_item_photo_bytes,
    save_teaware_photo_bytes,
    delete_object,
)

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
    amount_g: Optional[float] = None
    cover_url: Optional[str] = None
    tasting_count: int = 0
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
    amount_g: Optional[float] = None


class TeaItemAmountUpdate(BaseModel):
    # None — выключить учёт остатка; число >= 0 — новое значение в граммах
    amount_g: Optional[float] = None


class TeaItemListOut(BaseModel):
    items: List[TeaItemOut]
    total: int


class TeawareOut(BaseModel):
    id: int
    name: str
    type: Optional[str]
    volume_ml: Optional[int]
    material: Optional[str]
    region: Optional[str] = None
    suitable_csv: Optional[str] = None
    notes: Optional[str]
    cover_url: Optional[str] = None
    tasting_count: int = 0
    created_at: datetime.datetime
    class Config:
        from_attributes = True


class TeawareCreate(BaseModel):
    name: str
    type: Optional[str] = None
    volume_ml: Optional[int] = None
    material: Optional[str] = None
    region: Optional[str] = None
    suitable_csv: Optional[str] = None
    notes: Optional[str] = None


class TeawareListOut(BaseModel):
    items: List[TeawareOut]
    total: int


class TastingShortOut(BaseModel):
    id: int
    name: str
    created_at: datetime.datetime
    cover_url: Optional[str] = None
    class Config:
        from_attributes = True


class TastingsListOut(BaseModel):
    items: List[TastingShortOut]
    total: int


# ---- Чай ----

@router.get("/tea", response_model=TeaItemListOut)
def list_tea(
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    total = db.execute(
        select(func.count(TeaItem.id)).where(TeaItem.user_id == user_id)
    ).scalar_one()

    items = db.execute(
        select(TeaItem)
        .where(TeaItem.user_id == user_id)
        .order_by(TeaItem.created_at.desc())
        .limit(limit)
        .offset(offset)
    ).scalars().all()

    item_ids = [it.id for it in items]
    counts: dict[int, int] = {}
    if item_ids:
        rows = db.execute(
            select(Tasting.tea_item_id, func.count(Tasting.id))
            .where(Tasting.user_id == user_id, Tasting.tea_item_id.in_(item_ids))
            .group_by(Tasting.tea_item_id)
        ).all()
        counts = {row[0]: row[1] for row in rows}

    result: List[TeaItemOut] = []
    for item in items:
        out = TeaItemOut.model_validate(item)
        out.tasting_count = counts.get(item.id, 0)
        if item.cover_object_key:
            try:
                out.cover_url = get_presigned_url(item.cover_object_key)
            except Exception:
                pass
        result.append(out)

    return TeaItemListOut(items=result, total=total)


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


@router.post("/tea/{item_id}/photo", response_model=TeaItemOut)
async def upload_tea_photo(
    item_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    item = db.get(TeaItem, item_id)
    if not item or item.user_id != user_id:
        raise HTTPException(status_code=404, detail="Не найдено")

    body = await file.read()
    if not body:
        raise HTTPException(status_code=400, detail="Пустой файл")

    saved = save_tea_item_photo_bytes(
        user_id=user_id,
        tea_item_id=item.id,
        body=body,
        filename_hint=file.filename or "photo.jpg",
    )
    # Старый cover больше не нужен — чистим из хранилища
    if item.cover_object_key and item.cover_object_key != saved.object_key:
        delete_object(item.cover_object_key)
    item.cover_object_key = saved.object_key
    db.commit()
    db.refresh(item)

    out = TeaItemOut.model_validate(item)
    if item.cover_object_key:
        try:
            out.cover_url = get_presigned_url(item.cover_object_key)
        except Exception:
            pass
    return out


@router.patch("/tea/{item_id}/amount", response_model=TeaItemOut)
def update_tea_amount(
    item_id: int,
    data: TeaItemAmountUpdate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    item = db.get(TeaItem, item_id)
    if not item or item.user_id != user_id:
        raise HTTPException(status_code=404, detail="Не найдено")
    if data.amount_g is not None and data.amount_g < 0:
        raise HTTPException(status_code=400, detail="Остаток не может быть отрицательным")

    item.amount_g = data.amount_g
    db.commit()
    db.refresh(item)

    out = TeaItemOut.model_validate(item)
    if item.cover_object_key:
        try:
            out.cover_url = get_presigned_url(item.cover_object_key)
        except Exception:
            pass
    return out


@router.get("/tea/{item_id}/tastings", response_model=TastingsListOut)
def list_tea_tastings(
    item_id: int,
    limit: int = Query(3, ge=1, le=50),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    item = db.get(TeaItem, item_id)
    if not item or item.user_id != user_id:
        raise HTTPException(status_code=404, detail="Не найдено")

    total = db.execute(
        select(func.count(Tasting.id)).where(
            Tasting.user_id == user_id, Tasting.tea_item_id == item_id
        )
    ).scalar_one()

    rows = db.execute(
        select(Tasting)
        .where(Tasting.user_id == user_id, Tasting.tea_item_id == item_id)
        .order_by(Tasting.created_at.desc())
        .limit(limit)
        .offset(offset)
    ).scalars().all()

    items = [TastingShortOut.model_validate(t) for t in rows]

    if items:
        tasting_ids = [t.id for t in items]
        photos = db.execute(
            select(Photo)
            .where(Photo.tasting_id.in_(tasting_ids))
            .where(Photo.storage_backend == "s3")
            .where(Photo.object_key.isnot(None))
            .order_by(Photo.tasting_id, Photo.id)
        ).scalars().all()
        cover_map: dict[int, str] = {}
        for p in photos:
            if p.tasting_id not in cover_map:
                try:
                    cover_map[p.tasting_id] = get_presigned_url(p.object_key)
                except Exception:
                    pass
        for item in items:
            item.cover_url = cover_map.get(item.id)

    return TastingsListOut(items=items, total=total)


@router.delete("/tea/{item_id}")
def delete_tea(
    item_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    item = db.get(TeaItem, item_id)
    if not item or item.user_id != user_id:
        raise HTTPException(status_code=404, detail="Не найдено")
    delete_object(item.cover_object_key)
    db.delete(item)
    db.commit()
    return {"ok": True}


# ---- Посуда ----

@router.get("/teaware", response_model=TeawareListOut)
def list_teaware(
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    total = db.execute(
        select(func.count(Teaware.id)).where(Teaware.user_id == user_id)
    ).scalar_one()

    items = db.execute(
        select(Teaware)
        .where(Teaware.user_id == user_id)
        .order_by(Teaware.created_at.desc())
        .limit(limit)
        .offset(offset)
    ).scalars().all()

    item_ids = [it.id for it in items]
    counts: dict[int, int] = {}
    if item_ids:
        rows = db.execute(
            select(Tasting.teaware_id, func.count(Tasting.id))
            .where(Tasting.user_id == user_id, Tasting.teaware_id.in_(item_ids))
            .group_by(Tasting.teaware_id)
        ).all()
        counts = {row[0]: row[1] for row in rows}

    result: List[TeawareOut] = []
    for item in items:
        out = TeawareOut.model_validate(item)
        out.tasting_count = counts.get(item.id, 0)
        if item.cover_object_key:
            try:
                out.cover_url = get_presigned_url(item.cover_object_key)
            except Exception:
                pass
        result.append(out)

    return TeawareListOut(items=result, total=total)


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


@router.post("/teaware/{item_id}/photo", response_model=TeawareOut)
async def upload_teaware_photo(
    item_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    item = db.get(Teaware, item_id)
    if not item or item.user_id != user_id:
        raise HTTPException(status_code=404, detail="Не найдено")

    body = await file.read()
    if not body:
        raise HTTPException(status_code=400, detail="Пустой файл")

    saved = save_teaware_photo_bytes(
        user_id=user_id,
        teaware_id=item.id,
        body=body,
        filename_hint=file.filename or "photo.jpg",
    )
    # Старый cover больше не нужен — чистим из хранилища
    if item.cover_object_key and item.cover_object_key != saved.object_key:
        delete_object(item.cover_object_key)
    item.cover_object_key = saved.object_key
    db.commit()
    db.refresh(item)

    out = TeawareOut.model_validate(item)
    if item.cover_object_key:
        try:
            out.cover_url = get_presigned_url(item.cover_object_key)
        except Exception:
            pass
    return out


@router.get("/teaware/{item_id}/tastings", response_model=TastingsListOut)
def list_teaware_tastings(
    item_id: int,
    limit: int = Query(3, ge=1, le=50),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    item = db.get(Teaware, item_id)
    if not item or item.user_id != user_id:
        raise HTTPException(status_code=404, detail="Не найдено")

    total = db.execute(
        select(func.count(Tasting.id)).where(
            Tasting.user_id == user_id, Tasting.teaware_id == item_id
        )
    ).scalar_one()

    rows = db.execute(
        select(Tasting)
        .where(Tasting.user_id == user_id, Tasting.teaware_id == item_id)
        .order_by(Tasting.created_at.desc())
        .limit(limit)
        .offset(offset)
    ).scalars().all()

    items = [TastingShortOut.model_validate(t) for t in rows]

    if items:
        tasting_ids = [t.id for t in items]
        photos = db.execute(
            select(Photo)
            .where(Photo.tasting_id.in_(tasting_ids))
            .where(Photo.storage_backend == "s3")
            .where(Photo.object_key.isnot(None))
            .order_by(Photo.tasting_id, Photo.id)
        ).scalars().all()
        cover_map: dict[int, str] = {}
        for p in photos:
            if p.tasting_id not in cover_map:
                try:
                    cover_map[p.tasting_id] = get_presigned_url(p.object_key)
                except Exception:
                    pass
        for short in items:
            short.cover_url = cover_map.get(short.id)

    return TastingsListOut(items=items, total=total)


@router.delete("/teaware/{item_id}")
def delete_teaware(
    item_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    item = db.get(Teaware, item_id)
    if not item or item.user_id != user_id:
        raise HTTPException(status_code=404, detail="Не найдено")
    delete_object(item.cover_object_key)
    db.delete(item)
    db.commit()
    return {"ok": True}

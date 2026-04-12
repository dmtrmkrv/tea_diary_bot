from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from app.api.deps import get_db
from app.api.auth import get_current_user_id
from app.db.models import Tasting, Infusion, Photo
from app.services.storage import get_presigned_url

router = APIRouter(prefix="/tastings", tags=["tastings"])

class InfusionOut(BaseModel):
    n: int
    seconds: Optional[int]
    liquor_color: Optional[str]
    taste: Optional[str]
    body: Optional[str]
    aftertaste: Optional[str]
    class Config:
        from_attributes = True

class TastingOut(BaseModel):
    id: int
    seq_no: int
    name: str
    category: str
    year: Optional[int]
    region: Optional[str]
    rating: int
    grams: Optional[float]
    temp_c: Optional[int]
    gear: Optional[str]
    aroma_dry: Optional[str]
    aroma_warmed: Optional[str]
    effects_csv: Optional[str]
    summary: Optional[str]
    entry_mode: str
    cover_url: Optional[str] = None
    class Config:
        from_attributes = True

class TastingDetail(TastingOut):
    infusions: List[InfusionOut] = []
    photo_count: int = 0
    photo_urls: List[str] = []

@router.get("", response_model=List[TastingOut])
def list_tastings(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
    limit: int = 20,
    offset: int = 0,
):
    rows = db.execute(
        select(Tasting)
        .where(Tasting.user_id == user_id)
        .order_by(Tasting.id.desc())
        .limit(limit)
        .offset(offset)
    ).scalars().all()

    result = []
    for tasting in rows:
        item = TastingOut.model_validate(tasting)
        first_photo = db.execute(
            select(Photo)
            .where(Photo.tasting_id == tasting.id)
            .where(Photo.storage_backend == "s3")
            .where(Photo.object_key.isnot(None))
            .limit(1)
        ).scalar_one_or_none()
        if first_photo:
            try:
                item.cover_url = get_presigned_url(first_photo.object_key)
            except Exception:
                pass
        result.append(item)
    return result

@router.get("/{tasting_id}", response_model=TastingDetail)
def get_tasting(
    tasting_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    tasting = db.get(Tasting, tasting_id)
    if not tasting or tasting.user_id != user_id:
        raise HTTPException(status_code=404, detail="Не найдено")

    infusions = db.execute(
        select(Infusion)
        .where(Infusion.tasting_id == tasting_id)
        .order_by(Infusion.n)
    ).scalars().all()

    photos = db.execute(
        select(Photo).where(Photo.tasting_id == tasting_id)
    ).scalars().all()

    photo_urls = []
    for photo in photos:
        if photo.storage_backend == "s3" and photo.object_key:
            try:
                url = get_presigned_url(photo.object_key)
                photo_urls.append(url)
            except Exception:
                pass

    result = TastingDetail.model_validate(tasting)
    result.infusions = list(infusions)
    result.photo_count = len(photos)
    result.photo_urls = photo_urls
    return result

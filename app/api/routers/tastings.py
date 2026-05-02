import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import select
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from app.api.deps import get_db
from app.api.auth import get_current_user_id
from app.db.models import Tasting, Infusion, Photo, TeaItem
from app.services.storage import get_presigned_url, save_photo_bytes

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


class InfusionCreate(BaseModel):
    n: int
    seconds: Optional[int] = None
    liquor_color: Optional[str] = None
    taste: Optional[str] = None
    special_notes: Optional[str] = None
    body: Optional[str] = None
    aftertaste: Optional[str] = None


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
    created_at: Optional[datetime.datetime] = None
    cover_url: Optional[str] = None
    tea_item_id: Optional[int] = None
    tea_item_name: Optional[str] = None
    tea_item_category: Optional[str] = None
    tea_item_year: Optional[int] = None
    tea_item_region: Optional[str] = None
    tea_item_cover_url: Optional[str] = None
    class Config:
        from_attributes = True

class TastingDetail(TastingOut):
    infusions: List[InfusionOut] = []
    photo_count: int = 0
    photo_urls: List[str] = []


class TastingCreate(BaseModel):
    name: str
    tea_item_id: Optional[int] = None
    teaware_id: Optional[int] = None
    grams: Optional[float] = None
    temp_c: Optional[int] = None
    tasted_at: Optional[str] = None
    aroma_dry: Optional[str] = None
    aroma_warmed: Optional[str] = None
    aroma_after: Optional[str] = None
    effects_csv: Optional[str] = None
    scenarios_csv: Optional[str] = None
    rating: int = 0
    summary: Optional[str] = None
    entry_mode: str = "web"
    infusions: List[InfusionCreate] = []


@router.get("", response_model=List[TastingOut])
def list_tastings(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
    limit: int = 20,
    offset: int = 0,
):
    rows = db.execute(
        select(Tasting, TeaItem)
        .outerjoin(TeaItem, Tasting.tea_item_id == TeaItem.id)
        .where(Tasting.user_id == user_id)
        .order_by(Tasting.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()

    result = []
    for tasting, tea_item in rows:
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

        if tea_item is not None:
            item.tea_item_name = tea_item.name
            item.tea_item_category = tea_item.category
            item.tea_item_year = tea_item.year
            item.tea_item_region = tea_item.region
            if tea_item.cover_object_key:
                try:
                    item.tea_item_cover_url = get_presigned_url(tea_item.cover_object_key)
                except Exception:
                    pass

        result.append(item)
    return result


@router.post("", response_model=TastingOut, status_code=201)
def create_tasting_api(
    data: TastingCreate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    from app.services.tastings import create_tasting

    category = ""
    year: Optional[int] = None
    region: Optional[str] = None
    if data.tea_item_id is not None:
        tea_item = db.get(TeaItem, data.tea_item_id)
        if not tea_item or tea_item.user_id != user_id:
            raise HTTPException(status_code=400, detail="Сорт не найден")
        category = tea_item.category or ""
        year = tea_item.year
        region = tea_item.region

    tasted_at = data.tasted_at or datetime.datetime.utcnow().strftime("%H:%M")

    tasting_data = {
        "user_id": user_id,
        "name": data.name,
        "category": category,
        "year": year,
        "region": region,
        "tea_item_id": data.tea_item_id,
        "teaware_id": data.teaware_id,
        "grams": data.grams,
        "temp_c": data.temp_c,
        "tasted_at": tasted_at,
        "aroma_dry": data.aroma_dry,
        "aroma_warmed": data.aroma_warmed,
        "aroma_after": data.aroma_after,
        "effects_csv": data.effects_csv,
        "scenarios_csv": data.scenarios_csv,
        "rating": data.rating,
        "summary": data.summary,
        "entry_mode": data.entry_mode,
    }
    infusions = [inf.model_dump() for inf in data.infusions]
    tasting = create_tasting(tasting_data, infusions, [])
    return TastingOut.model_validate(tasting)


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

    if tasting.tea_item_id:
        tea_item = db.get(TeaItem, tasting.tea_item_id)
        if tea_item is not None:
            result.tea_item_name = tea_item.name
            result.tea_item_category = tea_item.category
            result.tea_item_year = tea_item.year
            result.tea_item_region = tea_item.region
            if tea_item.cover_object_key:
                try:
                    result.tea_item_cover_url = get_presigned_url(tea_item.cover_object_key)
                except Exception:
                    pass

    return result


@router.post("/{tasting_id}/photos", response_model=TastingDetail)
async def upload_tasting_photos(
    tasting_id: int,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    tasting = db.get(Tasting, tasting_id)
    if not tasting or tasting.user_id != user_id:
        raise HTTPException(status_code=404, detail="Не найдено")

    if len(files) > 3:
        raise HTTPException(status_code=400, detail="Не более 3 фото")

    for upload in files:
        body = await upload.read()
        if not body:
            continue
        saved = save_photo_bytes(
            user_id=user_id,
            tasting_id=tasting.id,
            body=body,
            filename_hint=upload.filename or "photo.jpg",
        )
        db.add(
            Photo(
                tasting_id=tasting.id,
                file_id=saved.object_key or "",
                storage_backend=saved.storage_backend,
                object_key=saved.object_key,
                content_type=saved.content_type,
                size_bytes=saved.size_bytes,
            )
        )
    db.commit()

    return get_tasting(tasting_id, db, user_id)

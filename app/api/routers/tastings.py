import csv
import datetime
import io
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from app.api.deps import get_db
from app.api.auth import get_current_user_id
from app.db.models import Tasting, Infusion, Photo, TeaItem, Teaware, User
from app.services.storage import get_presigned_url, save_photo_bytes, delete_object

router = APIRouter(prefix="/tastings", tags=["tastings"])

class InfusionOut(BaseModel):
    n: int
    seconds: Optional[int]
    liquor_color: Optional[str]
    taste: Optional[str]
    special_notes: Optional[str] = None
    body: Optional[str]
    aftertaste: Optional[str]
    note: Optional[str] = None
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
    note: Optional[str] = None


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
    scenarios_csv: Optional[str] = None
    summary: Optional[str]
    entry_mode: str
    created_at: Optional[datetime.datetime] = None
    cover_url: Optional[str] = None
    teaware_id: Optional[int] = None
    teaware_name: Optional[str] = None
    teaware_type: Optional[str] = None
    teaware_volume_ml: Optional[int] = None
    teaware_material: Optional[str] = None
    teaware_region: Optional[str] = None
    teaware_cover_url: Optional[str] = None
    tea_item_id: Optional[int] = None
    tea_item_name: Optional[str] = None
    tea_item_category: Optional[str] = None
    tea_item_year: Optional[int] = None
    tea_item_region: Optional[str] = None
    tea_item_cover_url: Optional[str] = None
    tea_item_amount_g: Optional[float] = None
    class Config:
        from_attributes = True

class PhotoOut(BaseModel):
    id: int
    url: str


class TastingDetail(TastingOut):
    infusions: List[InfusionOut] = []
    photo_count: int = 0
    photo_urls: List[str] = []
    # Не называть это поле `photos`: у ORM-модели Tasting есть relationship
    # `photos`, и model_validate(from_attributes) попытался бы провалидировать
    # ORM-объекты Photo как PhotoOut (без url) → ValidationError/500.
    photo_list: List[PhotoOut] = []


class TastingListOut(BaseModel):
    items: List[TastingOut]
    total: int


class TastingCreate(BaseModel):
    name: str
    tasted_date: Optional[datetime.date] = None  # бэкдейтинг: дата дегустации
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


class TastingUpdate(BaseModel):
    # entry_mode намеренно не редактируется (web/quick/full остаётся как был).
    name: str
    tasted_date: Optional[datetime.date] = None
    tea_item_id: Optional[int] = None
    teaware_id: Optional[int] = None
    grams: Optional[float] = None
    temp_c: Optional[int] = None
    aroma_dry: Optional[str] = None
    aroma_warmed: Optional[str] = None
    effects_csv: Optional[str] = None
    scenarios_csv: Optional[str] = None
    rating: int = 0
    summary: Optional[str] = None
    infusions: List[InfusionCreate] = []


@router.get("", response_model=TastingListOut)
def list_tastings(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
    limit: int = 20,
    offset: int = 0,
    q: str = "",
    categories: str = "",
    teaware_ids: str = "",
    rating_min: int = 0,
):
    # Поиск/фильтры (комбинируются по AND, значения внутри фильтра — OR).
    # Текстовый поиск — по названию дегустации И названию привязанного сорта.
    filters = [Tasting.user_id == user_id]
    q_clean = q.strip()
    if q_clean:
        pattern = f"%{q_clean}%"
        filters.append(
            Tasting.name.ilike(pattern) | TeaItem.name.ilike(pattern)
        )
    cat_list = [c.strip() for c in categories.split(",") if c.strip()]
    if cat_list:
        filters.append(Tasting.category.in_(cat_list))
    tw_list = [int(t) for t in teaware_ids.split(",") if t.strip().isdigit()]
    if tw_list:
        filters.append(Tasting.teaware_id.in_(tw_list))
    if rating_min > 0:
        filters.append(Tasting.rating >= rating_min)

    # outerjoin на TeaItem нужен и для count (текстовый поиск по сорту)
    total = db.execute(
        select(func.count(Tasting.id))
        .outerjoin(TeaItem, Tasting.tea_item_id == TeaItem.id)
        .where(*filters)
    ).scalar_one()

    rows = db.execute(
        select(Tasting, TeaItem)
        .outerjoin(TeaItem, Tasting.tea_item_id == TeaItem.id)
        .where(*filters)
        .order_by(Tasting.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()

    result = []
    for tasting, tea_item in rows:
        item = TastingOut.model_validate(tasting)
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

    if result:
        tasting_ids = [item.id for item in result]
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
        for item in result:
            item.cover_url = cover_map.get(item.id)
    return TastingListOut(items=result, total=total)


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

    if data.teaware_id is not None:
        teaware = db.get(Teaware, data.teaware_id)
        if not teaware or teaware.user_id != user_id:
            raise HTTPException(status_code=400, detail="Посуда не найдена")

    # Часовой пояс пользователя (автоопределяется на вебе): время и «сегодня»
    # считаем в его локальной зоне, а не в серверной (UTC/Amsterdam).
    user = db.get(User, user_id)
    tz_offset = (user.tz_offset_min if user else 0) or 0
    user_now = datetime.datetime.utcnow() + datetime.timedelta(minutes=tz_offset)

    tasted_at = data.tasted_at or user_now.strftime("%H:%M")

    # Бэкдейтинг: прошлая дата (относительно локального «сегодня» юзера)
    # сохраняется с временем 00:00 — фронт показывает только дату, без времени.
    created_at: Optional[datetime.datetime] = None
    if data.tasted_date is not None and data.tasted_date != user_now.date():
        created_at = datetime.datetime.combine(data.tasted_date, datetime.time.min)

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
    if created_at is not None:
        tasting_data["created_at"] = created_at
    infusions = [inf.model_dump() for inf in data.infusions]
    tasting = create_tasting(tasting_data, infusions, [])
    return TastingOut.model_validate(tasting)


@router.get("/export.csv")
def export_tastings_csv(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    """Экспорт всех дегустаций пользователя в CSV (Excel-friendly: BOM, ;)."""
    rows = db.execute(
        select(Tasting, TeaItem, Teaware)
        .outerjoin(TeaItem, Tasting.tea_item_id == TeaItem.id)
        .outerjoin(Teaware, Tasting.teaware_id == Teaware.id)
        .where(Tasting.user_id == user_id)
        .order_by(Tasting.seq_no)
    ).all()

    tasting_ids = [t.id for t, _, _ in rows]
    infusions_map: dict[int, list[Infusion]] = {}
    if tasting_ids:
        for inf in db.execute(
            select(Infusion)
            .where(Infusion.tasting_id.in_(tasting_ids))
            .order_by(Infusion.tasting_id, Infusion.n)
        ).scalars():
            infusions_map.setdefault(inf.tasting_id, []).append(inf)

    def infusions_text(items: list[Infusion]) -> str:
        parts = []
        for inf in items:
            bits = [f"№{inf.n}"]
            if inf.seconds is not None:
                bits.append(f"{inf.seconds}с")
            for value in (inf.liquor_color, inf.taste, inf.body, inf.aftertaste,
                          inf.special_notes, inf.note):
                if value:
                    bits.append(value)
            parts.append(", ".join(bits))
        return " | ".join(parts)

    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=";")
    writer.writerow([
        "№", "Дата", "Название", "Категория", "Год", "Регион",
        "Сорт из коллекции", "Посуда", "Вес (г)", "Температура (°C)",
        "Оценка", "Аромат сухого листа", "Аромат прогретого листа",
        "Ощущения", "Сценарии", "Заметка", "Проливы",
    ])
    for tasting, tea_item, teaware in rows:
        writer.writerow([
            tasting.seq_no,
            tasting.created_at.strftime("%Y-%m-%d %H:%M") if tasting.created_at else "",
            tasting.name,
            tasting.category or "",
            tasting.year or "",
            tasting.region or "",
            tea_item.name if tea_item else "",
            teaware.name if teaware else (tasting.gear or ""),
            tasting.grams if tasting.grams is not None else "",
            tasting.temp_c if tasting.temp_c is not None else "",
            tasting.rating or "",
            tasting.aroma_dry or "",
            tasting.aroma_warmed or "",
            tasting.effects_csv or "",
            tasting.scenarios_csv or "",
            tasting.summary or "",
            infusions_text(infusions_map.get(tasting.id, [])),
        ])

    # BOM — чтобы Excel корректно открыл UTF-8
    payload = "\ufeff" + buffer.getvalue()
    filename = f"leafpulse-tastings-{datetime.date.today().isoformat()}.csv"
    return StreamingResponse(
        iter([payload]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


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
    photo_items: List[PhotoOut] = []
    for photo in photos:
        if photo.storage_backend == "s3" and photo.object_key:
            try:
                url = get_presigned_url(photo.object_key)
                photo_urls.append(url)
                photo_items.append(PhotoOut(id=photo.id, url=url))
            except Exception:
                pass

    result = TastingDetail.model_validate(tasting)
    result.infusions = list(infusions)
    result.photo_count = len(photos)
    result.photo_urls = photo_urls
    result.photo_list = photo_items

    if tasting.tea_item_id:
        tea_item = db.get(TeaItem, tasting.tea_item_id)
        if tea_item is not None:
            result.tea_item_name = tea_item.name
            result.tea_item_category = tea_item.category
            result.tea_item_year = tea_item.year
            result.tea_item_region = tea_item.region
            result.tea_item_amount_g = tea_item.amount_g
            if tea_item.cover_object_key:
                try:
                    result.tea_item_cover_url = get_presigned_url(tea_item.cover_object_key)
                except Exception:
                    pass

    if tasting.teaware_id:
        teaware = db.get(Teaware, tasting.teaware_id)
        if teaware is not None:
            result.teaware_name = teaware.name
            result.teaware_type = teaware.type
            result.teaware_volume_ml = teaware.volume_ml
            result.teaware_material = teaware.material
            result.teaware_region = teaware.region
            if teaware.cover_object_key:
                try:
                    result.teaware_cover_url = get_presigned_url(teaware.cover_object_key)
                except Exception:
                    pass

    return result


def _effective_date(
    created_at: Optional[datetime.datetime], tz_offset: int
) -> Optional[datetime.date]:
    """Дата дегустации с учётом бэкдейт-маркера.

    created_at в 00:00 UTC — это маркер «только дата» (бэкдейт): дата берётся
    как есть. Иначе — обычная запись, дату считаем в зоне пользователя.
    """
    if created_at is None:
        return None
    if created_at.hour == 0 and created_at.minute == 0:
        return created_at.date()
    local = created_at + datetime.timedelta(minutes=tz_offset)
    return local.date()


@router.patch("/{tasting_id}", response_model=TastingDetail)
def update_tasting_api(
    tasting_id: int,
    data: TastingUpdate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    from app.services.tastings import update_tasting

    existing = db.get(Tasting, tasting_id)
    if not existing or existing.user_id != user_id:
        raise HTTPException(status_code=404, detail="Не найдено")

    fields: dict = {
        "name": data.name,
        "tea_item_id": data.tea_item_id,
        "teaware_id": data.teaware_id,
        "grams": data.grams,
        "temp_c": data.temp_c,
        "aroma_dry": data.aroma_dry,
        "aroma_warmed": data.aroma_warmed,
        "effects_csv": data.effects_csv,
        "scenarios_csv": data.scenarios_csv,
        "rating": data.rating,
        "summary": data.summary,
    }

    # Денормализованные category/year/region берём из карточки сорта — только
    # когда привязка задана. Без привязки эти поля не трогаем, чтобы не затереть
    # ручные значения у legacy-записей из бота.
    if data.tea_item_id is not None:
        tea_item = db.get(TeaItem, data.tea_item_id)
        if not tea_item or tea_item.user_id != user_id:
            raise HTTPException(status_code=400, detail="Сорт не найден")
        fields["category"] = tea_item.category or ""
        fields["year"] = tea_item.year
        fields["region"] = tea_item.region

    if data.teaware_id is not None:
        teaware = db.get(Teaware, data.teaware_id)
        if not teaware or teaware.user_id != user_id:
            raise HTTPException(status_code=400, detail="Посуда не найдена")

    # Дата дегустации (бэкдейтинг). Сдвиг даты считаем в зоне пользователя.
    # Прошлая дата → created_at = 00:00 (фронт покажет только дату). Возврат на
    # сегодня → created_at = текущее время. Дата не изменилась → не трогаем
    # created_at (иначе каждое сохранение сбивало бы время записи).
    if data.tasted_date is not None:
        user = db.get(User, user_id)
        tz_offset = (user.tz_offset_min if user else 0) or 0
        user_now = datetime.datetime.utcnow() + datetime.timedelta(minutes=tz_offset)
        if data.tasted_date != _effective_date(existing.created_at, tz_offset):
            if data.tasted_date == user_now.date():
                fields["created_at"] = datetime.datetime.utcnow()
            else:
                fields["created_at"] = datetime.datetime.combine(
                    data.tasted_date, datetime.time.min
                )

    infusions = [inf.model_dump() for inf in data.infusions]
    updated = update_tasting(tasting_id, user_id, fields, infusions)
    if updated is None:
        raise HTTPException(status_code=404, detail="Не найдено")

    # update_tasting коммитит в отдельной сессии — сбрасываем кэш request-сессии,
    # иначе get_tasting вернёт устаревший объект из identity-map.
    db.expire_all()
    return get_tasting(tasting_id, db, user_id)


@router.delete("/{tasting_id}")
def delete_tasting_api(
    tasting_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    tasting = db.get(Tasting, tasting_id)
    if not tasting or tasting.user_id != user_id:
        raise HTTPException(status_code=404, detail="Не найдено")

    # Возврат фактически списанного остатка сорта (deducted_g записывается
    # при создании с учётом clamp). Старые записи без deducted_g — без
    # возврата: по ним и не списывалось.
    if tasting.tea_item_id and tasting.deducted_g:
        tea_item = db.get(TeaItem, tasting.tea_item_id)
        if tea_item is not None and tea_item.amount_g is not None:
            tea_item.amount_g = tea_item.amount_g + tasting.deducted_g

    # Файлы фото из хранилища — до удаления записей (best-effort)
    photos = db.execute(
        select(Photo).where(Photo.tasting_id == tasting.id)
    ).scalars().all()
    for photo in photos:
        delete_object(photo.object_key, photo.storage_backend)

    db.delete(tasting)
    db.commit()
    return {"ok": True}


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


@router.delete("/{tasting_id}/photos/{photo_id}")
def delete_tasting_photo(
    tasting_id: int,
    photo_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    tasting = db.get(Tasting, tasting_id)
    if not tasting or tasting.user_id != user_id:
        raise HTTPException(status_code=404, detail="Не найдено")

    photo = db.get(Photo, photo_id)
    if not photo or photo.tasting_id != tasting_id:
        raise HTTPException(status_code=404, detail="Фото не найдено")

    # Сначала фиксируем удаление в БД, и только потом — файл из хранилища
    # (best-effort). Иначе при упавшем commit после успешного S3-delete
    # осталась бы строка Photo без объекта → битая картинка на детальной.
    # Сбой удаления файла оставит лишь осиротевший объект в S3 (мусор), что
    # безопаснее для пользователя.
    object_key = photo.object_key
    storage_backend = photo.storage_backend
    db.delete(photo)
    db.commit()
    delete_object(object_key, storage_backend)
    return {"ok": True}

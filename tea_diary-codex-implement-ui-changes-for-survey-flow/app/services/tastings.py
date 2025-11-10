"""Сервисные операции с дегустациями."""

from __future__ import annotations

from typing import Any, Sequence

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.db.engine import SessionLocal
from app.db.models import Infusion, Photo, Tasting
from app.services.storage import save_photo_bytes

_MAX_CREATE_ATTEMPTS = 2


def _next_seq_for_user(session, user_id: int) -> int:
    stmt = (
        select(Tasting.seq_no)
        .where(Tasting.user_id == user_id)
        .order_by(Tasting.seq_no.desc())
        .limit(1)
    )
    bind = session.bind
    if bind is not None and bind.dialect.name != "sqlite":
        stmt = stmt.with_for_update()
    last_seq = session.execute(stmt).scalar_one_or_none()
    return (last_seq or 0) + 1


def create_tasting(
    tasting_data: dict,
    infusions: Sequence[dict],
    photos: Sequence[Any],
) -> Tasting:
    """Создаёт дегустацию вместе с проливами и фото."""

    attempts = 0
    while attempts < _MAX_CREATE_ATTEMPTS:
        attempts += 1
        with SessionLocal() as session:
            try:
                with session.begin():
                    seq_no = _next_seq_for_user(session, tasting_data["user_id"])
                    tasting = Tasting(seq_no=seq_no, **tasting_data)
                    session.add(tasting)
                    session.flush()

                    for infusion in infusions:
                        session.add(
                            Infusion(
                                tasting_id=tasting.id,
                                n=infusion.get("n"),
                                seconds=infusion.get("seconds"),
                                liquor_color=infusion.get("liquor_color"),
                                taste=infusion.get("taste"),
                                special_notes=infusion.get("special_notes"),
                                body=infusion.get("body"),
                                aftertaste=infusion.get("aftertaste"),
                            )
                        )

                    for photo_entry in photos:
                        if isinstance(photo_entry, str):
                            session.add(
                                Photo(
                                    tasting_id=tasting.id,
                                    file_id=photo_entry,
                                    storage_backend="local",
                                    telegram_file_id=photo_entry,
                                )
                            )
                            continue

                        if not isinstance(photo_entry, dict):
                            continue

                        body = photo_entry.get("body")
                        telegram_file_id = photo_entry.get("telegram_file_id")
                        if body is None or telegram_file_id is None:
                            continue

                        filename_hint = (
                            photo_entry.get("filename_hint")
                            or photo_entry.get("filename")
                            or "photo.jpg"
                        )
                        result = save_photo_bytes(
                            tasting_data["user_id"],
                            tasting.id,
                            body,
                            filename_hint=filename_hint,
                        )
                        session.add(
                            Photo(
                                tasting_id=tasting.id,
                                file_id=telegram_file_id,
                                storage_backend=result.storage_backend,
                                object_key=result.object_key,
                                content_type=result.content_type,
                                size_bytes=result.size_bytes,
                                telegram_file_id=telegram_file_id,
                                telegram_file_unique_id=photo_entry.get(
                                    "telegram_file_unique_id"
                                ),
                            )
                        )

                session.refresh(tasting)
                return tasting
            except IntegrityError:
                if attempts >= _MAX_CREATE_ATTEMPTS:
                    raise
    raise RuntimeError("Failed to create tasting after retries")

"""Бэкфилл миниатюр для существующих фото и обложек.

Идёт по записям без миниатюры (photos.thumb_object_key IS NULL и обложки
сортов/посуды без cover_thumb_object_key), скачивает оригинал из хранилища,
генерит WEBP-миниатюру и дозаписывает ключ в БД.

Идемпотентный: коммит после каждой записи, повторный запуск продолжит
с необработанных. Ошибки по отдельным файлам не останавливают проход.

Запуск из корня репозитория (или /app в контейнере):
    python scripts/backfill_thumbs.py            # обработать всё
    python scripts/backfill_thumbs.py --dry-run  # только посчитать, без записи
"""

from __future__ import annotations

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select  # noqa: E402

from app.config import get_db_url, get_media_backend, get_s3_config  # noqa: E402
from app.db.engine import SessionLocal, create_sa_engine  # noqa: E402
from app.db.models import Photo, TeaItem, Teaware  # noqa: E402
from app.services.storage import (  # noqa: E402
    THUMB_CONTENT_TYPE,
    _s3_client,
    make_thumbnail_bytes,
    thumb_key_for,
)


def _load_original(object_key: str, backend: str) -> bytes | None:
    try:
        if backend == "s3":
            cfg = get_s3_config()
            obj = _s3_client().get_object(Bucket=cfg.bucket, Key=object_key)
            return obj["Body"].read()
        base_dir = os.path.abspath(os.getenv("MEDIA_DIR", "/app/media"))
        with open(os.path.join(base_dir, object_key), "rb") as handle:
            return handle.read()
    except Exception as exc:
        print(f"  ! не скачался {object_key} ({backend}): {exc}")
        return None


def _store_thumb(thumb_key: str, body: bytes, backend: str) -> bool:
    try:
        if backend == "s3":
            cfg = get_s3_config()
            _s3_client().put_object(
                Bucket=cfg.bucket,
                Key=thumb_key,
                Body=body,
                ContentType=THUMB_CONTENT_TYPE,
            )
            return True
        base_dir = os.path.abspath(os.getenv("MEDIA_DIR", "/app/media"))
        path = os.path.join(base_dir, thumb_key)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as handle:
            handle.write(body)
        return True
    except Exception as exc:
        print(f"  ! не сохранилась миниатюра {thumb_key} ({backend}): {exc}")
        return False


def _make_and_store(object_key: str, backend: str) -> str | None:
    """Скачать оригинал → сгенерить → сохранить. Возвращает ключ миниатюры."""
    original = _load_original(object_key, backend)
    if original is None:
        return None
    thumb_body = make_thumbnail_bytes(original)
    if thumb_body is None:
        print(f"  ! не сгенерилась миниатюра для {object_key}")
        return None
    thumb_key = thumb_key_for(object_key)
    if not _store_thumb(thumb_key, thumb_body, backend):
        return None
    return thumb_key


def backfill_photos(dry_run: bool) -> None:
    with SessionLocal() as session:
        photos = session.execute(
            select(Photo).where(
                Photo.thumb_object_key.is_(None), Photo.object_key.isnot(None)
            )
        ).scalars().all()
        print(f"Фото дегустаций без миниатюры: {len(photos)}")
        done = 0
        for photo in photos:
            if dry_run:
                continue
            thumb_key = _make_and_store(photo.object_key, photo.storage_backend)
            if thumb_key is None:
                continue
            photo.thumb_object_key = thumb_key
            session.commit()
            done += 1
            if done % 25 == 0:
                print(f"  … {done}/{len(photos)}")
        if not dry_run:
            print(f"  готово: {done}/{len(photos)}")


def backfill_covers(model, label: str, dry_run: bool) -> None:
    backend = get_media_backend()
    with SessionLocal() as session:
        items = session.execute(
            select(model).where(
                model.cover_thumb_object_key.is_(None),
                model.cover_object_key.isnot(None),
            )
        ).scalars().all()
        print(f"Обложки ({label}) без миниатюры: {len(items)}")
        done = 0
        for item in items:
            if dry_run:
                continue
            thumb_key = _make_and_store(item.cover_object_key, backend)
            if thumb_key is None:
                continue
            item.cover_thumb_object_key = thumb_key
            session.commit()
            done += 1
        if not dry_run:
            print(f"  готово: {done}/{len(items)}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Бэкфилл миниатюр фото/обложек")
    parser.add_argument(
        "--dry-run", action="store_true", help="только посчитать, ничего не менять"
    )
    args = parser.parse_args()

    # SessionLocal без явного bind не работает — движок настраивается на
    # старте приложения, скрипту нужно сделать это самому.
    create_sa_engine(get_db_url())

    backfill_photos(args.dry_run)
    backfill_covers(TeaItem, "сорта", args.dry_run)
    backfill_covers(Teaware, "посуда", args.dry_run)


if __name__ == "__main__":
    main()

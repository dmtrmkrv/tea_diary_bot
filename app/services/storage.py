"""Абстракция для сохранения медиа в S3 или локальное хранилище."""

from __future__ import annotations

import mimetypes
import os
import uuid
from dataclasses import dataclass
from typing import Optional

from app.config import get_media_backend, get_s3_config


@dataclass
class SaveResult:
    storage_backend: str
    object_key: Optional[str]
    content_type: Optional[str]
    size_bytes: int


def _suffix_from_name(name: str) -> str:
    ext = os.path.splitext(name)[1]
    return ext if ext else ".jpg"


def _guess_mime(filename: str, default: str = "image/jpeg") -> str:
    mt, _ = mimetypes.guess_type(filename)
    return mt or default


def _s3_client():
    import boto3
    from botocore.config import Config as BotoConfig

    cfg = get_s3_config()
    return boto3.client(
        "s3",
        endpoint_url=cfg.endpoint,
        region_name=cfg.region,
        aws_access_key_id=cfg.access_key,
        aws_secret_access_key=cfg.secret_key,
        config=BotoConfig(s3={"addressing_style": "path"}),
    )


def _save_bytes_with_prefix(
    key_prefix: str,
    body: bytes,
    filename_hint: str,
) -> SaveResult:
    backend = get_media_backend()
    size = len(body)
    content_type = _guess_mime(filename_hint)
    key = f"{key_prefix}/{uuid.uuid4().hex}{_suffix_from_name(filename_hint)}"

    cfg = get_s3_config()
    if (
        backend == "s3"
        and cfg.enabled
        and all([cfg.bucket, cfg.access_key, cfg.secret_key])
    ):
        try:
            _s3_client().put_object(
                Bucket=cfg.bucket,
                Key=key,
                Body=body,
                ContentType=content_type,
            )
            return SaveResult("s3", key, content_type, size)
        except Exception:
            # Фолбэк на локальное хранилище при ошибке S3.
            pass

    base_dir = os.path.abspath(os.getenv("MEDIA_DIR", "/app/media"))
    path = os.path.join(base_dir, key)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as handle:
        handle.write(body)
    return SaveResult("local", key, content_type, size)


def save_photo_bytes(
    user_id: int,
    tasting_id: int,
    body: bytes,
    filename_hint: str = "photo.jpg",
) -> SaveResult:
    return _save_bytes_with_prefix(
        f"tastings/{user_id}/{tasting_id}", body, filename_hint
    )


def save_tea_item_photo_bytes(
    user_id: int,
    tea_item_id: int,
    body: bytes,
    filename_hint: str = "photo.jpg",
) -> SaveResult:
    return _save_bytes_with_prefix(
        f"tea_items/{user_id}/{tea_item_id}", body, filename_hint
    )


def save_teaware_photo_bytes(
    user_id: int,
    teaware_id: int,
    body: bytes,
    filename_hint: str = "photo.jpg",
) -> SaveResult:
    return _save_bytes_with_prefix(
        f"teaware/{user_id}/{teaware_id}", body, filename_hint
    )


def delete_object(object_key: Optional[str], storage_backend: str = "s3") -> None:
    """Удаляет файл из хранилища (S3 или локального). Best-effort:
    ошибки глотаем — удаление записи в БД важнее, осиротевший файл
    хуже, чем упавший запрос пользователя."""
    if not object_key:
        return
    try:
        if storage_backend == "s3":
            cfg = get_s3_config()
            if cfg.enabled and all([cfg.bucket, cfg.access_key, cfg.secret_key]):
                _s3_client().delete_object(Bucket=cfg.bucket, Key=object_key)
                return
        # Локальный фоллбек (или backend == "local")
        base_dir = os.path.abspath(os.getenv("MEDIA_DIR", "/app/media"))
        path = os.path.join(base_dir, object_key)
        if os.path.isfile(path):
            os.remove(path)
    except Exception:
        pass


def get_presigned_url(key: str, expires: int = 3600) -> str:
    cfg = get_s3_config()
    return _s3_client().generate_presigned_url(
        "get_object",
        Params={"Bucket": cfg.bucket, "Key": key},
        ExpiresIn=expires,
    )


__all__ = [
    "SaveResult",
    "get_presigned_url",
    "save_photo_bytes",
    "save_tea_item_photo_bytes",
    "_s3_client",
]

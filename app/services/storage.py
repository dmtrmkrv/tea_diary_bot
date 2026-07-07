"""Абстракция для сохранения медиа в S3 или локальное хранилище."""

from __future__ import annotations

import io
import os
import uuid
from dataclasses import dataclass
from typing import Optional

from PIL import Image, ImageOps

from app.config import get_media_backend, get_s3_config


@dataclass
class SaveResult:
    storage_backend: str
    object_key: Optional[str]
    content_type: Optional[str]
    size_bytes: int
    # Ключ миниатюры; None, если генерация не удалась (фолбэк на оригинал)
    thumb_object_key: Optional[str] = None


def _suffix_from_name(name: str) -> str:
    ext = os.path.splitext(name)[1]
    return ext if ext else ".jpg"


# Лимит и проверка изображений при загрузке — одна точка для всех путей (фото
# дегустаций, обложки сортов и посуды все идут через _save_bytes_with_prefix).
MAX_UPLOAD_BYTES = 8 * 1024 * 1024  # 8 МБ на файл
_ALLOWED_IMAGE_FORMATS = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}


class ImageValidationError(Exception):
    """Файл не прошёл проверку размера/типа. Роутер мапит в HTTP с понятным
    сообщением для пользователя."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def validate_image_upload(body: bytes) -> str:
    """Проверяет размер и что это реальное изображение поддерживаемого формата.

    Возвращает content_type по распознанному формату (а не по имени файла —
    имя можно подделать). Иначе бросает ImageValidationError.
    """
    if len(body) > MAX_UPLOAD_BYTES:
        raise ImageValidationError(
            "file_too_large",
            "Файл больше 8 МБ — сожмите изображение или выберите файл поменьше.",
        )
    try:
        image = Image.open(io.BytesIO(body))
        fmt = image.format
        image.verify()  # проверка целостности; после verify() объект непригоден
    except Exception:
        raise ImageValidationError(
            "unsupported_file",
            "Не удалось распознать изображение. Поддерживаются JPEG, PNG и WEBP.",
        )
    content_type = _ALLOWED_IMAGE_FORMATS.get(fmt or "")
    if content_type is None:
        raise ImageValidationError(
            "unsupported_file",
            "Поддерживаются только изображения JPEG, PNG и WEBP.",
        )
    return content_type


# Параметры миниатюр для списков (лента, коллекция): WEBP, длинная сторона
# 800 px (хватает на 2x-ретину при ширине карточки ~375 CSS px), качество 78 —
# ~60–130 КБ вместо 2–3.5 МБ оригинала.
THUMB_MAX_SIDE = 800
THUMB_QUALITY = 78
THUMB_CONTENT_TYPE = "image/webp"


def thumb_key_for(object_key: str) -> str:
    """Ключ миниатюры рядом с оригиналом: <путь>/<имя>_thumb.webp."""
    base, _ = os.path.splitext(object_key)
    return f"{base}_thumb.webp"


def make_thumbnail_bytes(body: bytes) -> Optional[bytes]:
    """Генерирует миниатюру (WEBP). None при любой ошибке — миниатюра
    не должна ломать сохранение оригинала."""
    try:
        image = Image.open(io.BytesIO(body))
        # Поворот из EXIF: иначе фото с телефона в миниатюре лягут боком
        image = ImageOps.exif_transpose(image)
        if image.mode in ("P", "LA", "PA"):
            image = image.convert("RGBA")
        elif image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGB")
        image.thumbnail((THUMB_MAX_SIDE, THUMB_MAX_SIDE))
        out = io.BytesIO()
        image.save(out, format="WEBP", quality=THUMB_QUALITY)
        return out.getvalue()
    except Exception:
        return None


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
    content_type = validate_image_upload(body)  # размер + тип; иначе ImageValidationError
    key = f"{key_prefix}/{uuid.uuid4().hex}{_suffix_from_name(filename_hint)}"

    thumb_body = make_thumbnail_bytes(body)
    thumb_key = thumb_key_for(key) if thumb_body else None

    cfg = get_s3_config()
    if (
        backend == "s3"
        and cfg.enabled
        and all([cfg.bucket, cfg.access_key, cfg.secret_key])
    ):
        try:
            client = _s3_client()
            client.put_object(
                Bucket=cfg.bucket,
                Key=key,
                Body=body,
                ContentType=content_type,
            )
            saved_thumb_key = None
            if thumb_body and thumb_key:
                try:
                    client.put_object(
                        Bucket=cfg.bucket,
                        Key=thumb_key,
                        Body=thumb_body,
                        ContentType=THUMB_CONTENT_TYPE,
                    )
                    saved_thumb_key = thumb_key
                except Exception:
                    # Без миниатюры списки отдадут оригинал (фолбэк)
                    pass
            return SaveResult("s3", key, content_type, size, saved_thumb_key)
        except Exception:
            # Фолбэк на локальное хранилище при ошибке S3.
            pass

    base_dir = os.path.abspath(os.getenv("MEDIA_DIR", "/app/media"))
    path = os.path.join(base_dir, key)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as handle:
        handle.write(body)
    saved_thumb_key = None
    if thumb_body and thumb_key:
        try:
            thumb_path = os.path.join(base_dir, thumb_key)
            with open(thumb_path, "wb") as handle:
                handle.write(thumb_body)
            saved_thumb_key = thumb_key
        except Exception:
            pass
    return SaveResult("local", key, content_type, size, saved_thumb_key)


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
    "make_thumbnail_bytes",
    "save_photo_bytes",
    "save_tea_item_photo_bytes",
    "thumb_key_for",
    "_s3_client",
]

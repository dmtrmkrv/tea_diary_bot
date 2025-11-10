import os
from dataclasses import dataclass
from typing import Union

from dotenv import load_dotenv
from sqlalchemy.engine import URL


def _truthy(v: str | None) -> bool:
    return (v or "").lower() in {"1", "true", "t", "yes", "y"}


# Грузим .env только в дев-режиме:
# - если APP_ENV отсутствует ИЛИ не "production"
# - и не выставлен явный запрет PYTHON_DOTENV_DISABLED=1
APP_ENV = os.getenv("APP_ENV")
if (APP_ENV is None or APP_ENV.lower() != "production") and not _truthy(
    os.getenv("PYTHON_DOTENV_DISABLED")
):
    # override=False — не перезатираем уже заданные переменные окружения
    load_dotenv(override=False)


def get_bot_token() -> str:
    token = os.getenv("BOT_TOKEN")
    if not token:
        raise SystemExit("BOT_TOKEN is required")
    return token


def _pg_env_complete() -> bool:
    required = [
        "POSTGRESQL_HOST",
        "POSTGRESQL_PORT",
        "POSTGRESQL_DBNAME",
        "POSTGRESQL_USER",
        "POSTGRESQL_PASSWORD",
    ]
    return all(os.getenv(item) for item in required)


def get_db_url() -> Union[URL, str]:
    if _pg_env_complete():
        return URL.create(
            drivername="postgresql+psycopg",
            username=os.getenv("POSTGRESQL_USER"),
            password=os.getenv("POSTGRESQL_PASSWORD"),
            host=os.getenv("POSTGRESQL_HOST"),
            port=int(os.getenv("POSTGRESQL_PORT", "5432")),
            database=os.getenv("POSTGRESQL_DBNAME"),
            query={"sslmode": os.getenv("POSTGRESQL_SSLMODE", "disable")},
        )
    return URL.create(drivername="sqlite", database="/app/tastings.db")


def get_app_env() -> str:
    return os.getenv("APP_ENV", "production")


def get_tz() -> str:
    return os.getenv("TZ", "Europe/Amsterdam")


def get_media_backend() -> str:
    return os.getenv("MEDIA_BACKEND", "local").lower()


@dataclass
class S3Config:
    enabled: bool
    endpoint: str | None
    region: str | None
    bucket: str | None
    access_key: str | None
    secret_key: str | None


def get_s3_config() -> S3Config:
    backend = get_media_backend() == "s3"
    return S3Config(
        enabled=backend,
        endpoint=os.getenv("S3_ENDPOINT_URL"),
        region=os.getenv("S3_REGION"),
        bucket=os.getenv("S3_BUCKET"),
        access_key=os.getenv("S3_ACCESS_KEY"),
        secret_key=os.getenv("S3_SECRET_KEY"),
    )

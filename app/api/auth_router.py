import hashlib
import hmac
import time
from typing import Optional
import jwt
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["auth"])

SECRET_KEY = os.getenv("JWT_SECRET", "dev-secret-change-in-prod")
BOT_TOKEN = os.getenv("BOT_TOKEN", "")
ALGORITHM = "HS256"
TOKEN_EXPIRE_SECONDS = 60 * 60 * 24 * 30  # 30 дней


class TelegramAuthData(BaseModel):
    id: int
    first_name: str
    last_name: Optional[str] = None
    username: Optional[str] = None
    photo_url: Optional[str] = None
    auth_date: int
    hash: str


def verify_telegram_auth(data: TelegramAuthData) -> bool:
    """Проверяем подпись от Телеграма."""
    check_hash = data.hash
    data_dict = data.model_dump(exclude={"hash"})
    data_check_string = "\n".join(
        f"{k}={v}" for k, v in sorted(data_dict.items()) if v is not None
    )
    secret_key = hashlib.sha256(BOT_TOKEN.encode()).digest()
    computed_hash = hmac.new(
        secret_key, data_check_string.encode(), hashlib.sha256
    ).hexdigest()

    if computed_hash != check_hash:
        return False

    # Проверяем что данные не старше 24 часов
    if time.time() - data.auth_date > 86400:
        return False

    return True


def create_jwt_token(user_id: int, username: Optional[str] = None) -> str:
    payload = {
        "sub": str(user_id),
        "username": username,
        "exp": int(time.time()) + TOKEN_EXPIRE_SECONDS,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_jwt_token(token: str) -> dict:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])


@router.post("/telegram")
def telegram_auth(data: TelegramAuthData):
    if not verify_telegram_auth(data):
        raise HTTPException(status_code=401, detail="Неверная подпись Telegram")

    token = create_jwt_token(data.id, data.username)
    return {"access_token": token, "token_type": "bearer"}

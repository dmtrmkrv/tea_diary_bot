import os
from fastapi import Header, HTTPException

def get_current_user_id(
    x_telegram_user_id: int = Header(..., description="Telegram user ID")
) -> int:
    return x_telegram_user_id

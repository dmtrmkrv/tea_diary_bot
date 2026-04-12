import os
from fastapi import Header, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt

SECRET_KEY = os.getenv("JWT_SECRET", "dev-secret-change-in-prod")
ALGORITHM = "HS256"

security = HTTPBearer(auto_error=False)


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    x_telegram_user_id: int = Header(None, description="Временный заголовок для разработки"),
) -> int:
    # JWT токен — основной способ
    if credentials:
        try:
            payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
            return int(payload["sub"])
        except Exception:
            raise HTTPException(status_code=401, detail="Неверный токен")

    # Временный заголовок — только для разработки
    if x_telegram_user_id:
        return x_telegram_user_id

    raise HTTPException(status_code=401, detail="Не авторизован")

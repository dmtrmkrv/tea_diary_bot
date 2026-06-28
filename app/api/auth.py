from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt

from app.config import JWT_ALGORITHM, get_jwt_secret

SECRET_KEY = get_jwt_secret()
ALGORITHM = JWT_ALGORITHM

security = HTTPBearer(auto_error=False)


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> int:
    # Единственный способ авторизации — подписанный JWT (Bearer-токен).
    # Раньше был дев-фолбэк на заголовок X-Telegram-User-Id без всякой проверки —
    # убран: на публичном API это был обход входа (любой мог представиться
    # чужим user_id и читать/удалять чужие данные). Фронт этот заголовок не шлёт.
    if not credentials:
        raise HTTPException(status_code=401, detail="Не авторизован")
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        return int(payload["sub"])
    except Exception:
        raise HTTPException(status_code=401, detail="Неверный токен")

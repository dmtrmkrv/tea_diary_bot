from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from sqlalchemy import select

from app.config import JWT_ALGORITHM, get_jwt_secret
from app.db.engine import SessionLocal
from app.db.models import User

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
        user_id = int(payload["sub"])
        # Токены, выданные до введения tv, считаем версией 0 — сессии целы.
        token_version = int(payload.get("tv") or 0)
    except Exception:
        raise HTTPException(status_code=401, detail="Неверный токен")
    # Одноцелевые токены (напр. purpose=reauth — подтверждение перед удалением
    # аккаунта) сессией не являются и как Bearer не принимаются.
    if payload.get("purpose"):
        raise HTTPException(status_code=401, detail="Неверный токен")
    # Сверка версии токена с БД: бамп users.token_version (смена пароля,
    # «выйти на всех устройствах») мгновенно отзывает все старые токены.
    # Заодно 401 для токенов удалённых аккаунтов (строки в БД уже нет).
    with SessionLocal() as session:
        db_version = session.execute(
            select(User.token_version).where(User.id == user_id)
        ).scalar_one_or_none()
    if db_version is None or db_version != token_version:
        raise HTTPException(status_code=401, detail="Сессия недействительна")
    return user_id

import logging
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from app.api.routers import tastings, users, collection
from app.api import auth_router
from app.api.ratelimit import limiter
from app.db.engine import create_sa_engine
from app.config import get_db_url, is_production

logger = logging.getLogger("teanotes.api")

create_sa_engine(get_db_url())

# В production прячем интерактивную доку и схему OpenAPI — чтобы не светить
# карту API публично (вне прода оставляем для удобства разработки).
_docs_disabled = is_production()
app = FastAPI(
    title="TeaNotes API",
    version="0.1.0",
    docs_url=None if _docs_disabled else "/docs",
    redoc_url=None if _docs_disabled else "/redoc",
    openapi_url=None if _docs_disabled else "/openapi.json",
)
# Rate limiter (slowapi) — нужен в app.state, чтобы работали декораторы лимитов.
app.state.limiter = limiter

# Разрешённые origin'ы фронта. На проде задаём CORS_ORIGINS (через запятую),
# иначе — дефолт для staging-фронта и локальной разработки.
_default_origins = [
    "https://dmtrmkrv-tea-diary-bot-0188.twc1.net",  # staging frontend
    "http://localhost:3000",  # local dev
]
_env_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
allow_origins = _env_origins or _default_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Необработанная ошибка → JSON-ответ 500 С CORS-заголовками.

    CORSMiddleware не навешивает заголовки на ответы, которые рождаются из
    необработанных исключений (они формируются внешним слоем, вне CORS).
    Поэтому без этого фронт на другом домене видит «непрозрачную» сетевую
    ошибку без кода и причины. Эхо разрешённого Origin + credentials повторяет
    то, что CORSMiddleware добавил бы к обычному ответу. Обычные HTTPException
    (4xx) сюда не попадают — у них свой обработчик, и заголовки им навешивает
    сам CORSMiddleware.
    """
    logger.exception("Unhandled error: %s %s", request.method, request.url.path)
    headers: dict[str, str] = {}
    origin = request.headers.get("origin")
    if origin and origin in allow_origins:
        headers = {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Vary": "Origin",
        }
    return JSONResponse(
        status_code=500,
        content={"detail": "Внутренняя ошибка сервера"},
        headers=headers,
    )


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    # Превышен лимит запросов → 429 с понятным detail (фронт показывает
    # detail.message). CORS-заголовки навешиваются автоматически: этот ответ
    # проходит обратно через CORSMiddleware (обычный обработчик исключения).
    return JSONResponse(
        status_code=429,
        content={"detail": {"code": "rate_limited", "message": "Слишком много запросов. Попробуйте чуть позже."}},
    )


app.include_router(tastings.router)
app.include_router(users.router)
app.include_router(auth_router.router)
app.include_router(collection.router)

@app.get("/health")
def health():
    return {"status": "ok"}

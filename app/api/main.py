import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routers import tastings, users, collection
from app.api import auth_router
from app.db.engine import create_sa_engine
from app.config import get_db_url

create_sa_engine(get_db_url())

app = FastAPI(
    title="TeaNotes API",
    version="0.1.0",
)

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

app.include_router(tastings.router)
app.include_router(users.router)
app.include_router(auth_router.router)
app.include_router(collection.router)

@app.get("/health")
def health():
    return {"status": "ok"}

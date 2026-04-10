from fastapi import FastAPI
from app.api.routers import tastings, users
from app.db.engine import create_sa_engine, engine as sa_engine
from app.config import get_db_url

# Инициализируем движок сразу при импорте модуля
create_sa_engine(get_db_url())

app = FastAPI(
    title="TeaNotes API",
    version="0.1.0",
)

app.include_router(tastings.router)
app.include_router(users.router)

@app.get("/health")
def health():
    return {"status": "ok"}

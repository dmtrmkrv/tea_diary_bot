from fastapi import FastAPI
from app.api.routers import tastings, users
from app.api import auth_router
from app.db.engine import create_sa_engine
from app.config import get_db_url

create_sa_engine(get_db_url())

app = FastAPI(
    title="TeaNotes API",
    version="0.1.0",
)

app.include_router(tastings.router)
app.include_router(users.router)
app.include_router(auth_router.router)

@app.get("/health")
def health():
    return {"status": "ok"}

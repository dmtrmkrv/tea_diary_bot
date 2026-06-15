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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://dmtrmkrv-tea-diary-bot-0188.twc1.net",  # staging frontend
        "http://localhost:3000",  # local dev
    ],
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

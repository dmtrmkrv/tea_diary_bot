import traceback
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
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

@app.exception_handler(Exception)
async def debug_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"error": str(exc), "trace": traceback.format_exc()}
    )

@app.get("/health")
def health():
    return {"status": "ok"}

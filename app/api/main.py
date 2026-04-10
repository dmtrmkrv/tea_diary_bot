from fastapi import FastAPI
from app.api.routers import tastings, users

app = FastAPI(
    title="TeaNotes API",
    version="0.1.0",
)

app.include_router(tastings.router)
app.include_router(users.router)

@app.get("/health")
def health():
    return {"status": "ok"}

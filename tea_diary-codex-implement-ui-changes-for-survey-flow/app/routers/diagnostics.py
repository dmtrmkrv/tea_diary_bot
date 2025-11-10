from aiogram import Router, types
from aiogram.filters import Command
from aiogram.filters.state import StateFilter
from sqlalchemy import create_engine, text

from app.config import get_db_url, get_media_backend, get_s3_config
from app.filters.admin_only import AdminOnly
from app.services.storage import _s3_client

def create_router(admin_ids: set[int], is_prod: bool) -> Router:
    """Создаёт и настраивает диагностический роутер."""
    router = Router(name="diagnostics")

    if is_prod and not admin_ids:
        return router

    @router.message(StateFilter("*"), Command("whoami"))
    async def whoami(message: types.Message):
        uid = int(message.from_user.id) if message.from_user else 0
        await message.answer(f"you_id={uid}\\nis_admin={uid in admin_ids}")

    @router.message(StateFilter("*"), AdminOnly(admin_ids), Command("dbinfo"))
    async def dbinfo(message: types.Message):
        url = get_db_url()
        try:
            safe = url.render_as_string(hide_password=True)
        except AttributeError:
            safe = str(url)
        await message.answer(f"DB URL: {safe}")

    @router.message(StateFilter("*"), AdminOnly(admin_ids), Command("health"))
    async def health(message: types.Message):
        engine = create_engine(get_db_url(), future=True)
        with engine.connect() as connection:
            db = connection.execute(text("select current_database()")).scalar()
            cnt = connection.execute(text("select count(*) from tastings")).scalar()
        s3_status = "disabled"
        if get_media_backend() == "s3":
            cfg = get_s3_config()
            try:
                _s3_client().list_objects_v2(Bucket=cfg.bucket, MaxKeys=1)
                s3_status = "ok"
            except Exception as exc:
                s3_status = f"error:{type(exc).__name__}"
        await message.answer(f"db={db}\\ncount(tastings)={cnt}\\ns3={s3_status}")

    return router

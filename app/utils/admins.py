import logging
import os


def _to_int(value: str) -> int | None:
    try:
        return int(value)
    except Exception:
        return None


def get_admin_ids() -> set[int]:
    raw = os.getenv("ADMINS", "")
    parts = [
        part.strip()
        for part in raw.replace(";", ",").replace(" ", ",").split(",")
        if part.strip()
    ]
    ids = {value for value in (_to_int(part) for part in parts) if value is not None}
    logging.getLogger(__name__).info("Admins configured: %d", len(ids))
    return ids

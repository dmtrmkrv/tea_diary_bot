#!/usr/bin/env bash
set -euo pipefail

export PYTHONPATH=/app
cd /app

# 0) Maintenance: всегда открыть консоль
if [[ "${MAINTENANCE:-0}" == "1" ]]; then
  echo "[ENTRYPOINT] MAINTENANCE MODE — container is up, skipping app and migrations."
  exec tail -f /dev/null
fi

# 1) Печатаем ENV/DSN для явной диагностики
echo "[ENTRYPOINT] ENV user=${POSTGRESQL_USER:-} host=${POSTGRESQL_HOST:-} db=${POSTGRESQL_DBNAME:-} sslmode=${POSTGRESQL_SSLMODE:-}"
python - <<'PY'
from app.config import get_db_url

url = get_db_url()
try:
    safe = url.render_as_string(hide_password=True)
except AttributeError:
    safe = str(url)
print("[ENTRYPOINT] DSN:", safe)
PY

# 2) Миграции (опционально)
if [[ "${SKIP_MIGRATIONS:-0}" != "1" ]]; then
  echo "[ENTRYPOINT] Running Alembic migrations..."
  set +e
  python -m alembic -c alembic.ini upgrade head
  status=$?
  set -e
  if [[ $status -ne 0 ]]; then
    echo "[ENTRYPOINT] Alembic FAILED with code ${status}"
    if [[ "${FAIL_ON_MIGRATIONS:-0}" == "1" ]]; then
      echo "[ENTRYPOINT] FAIL_ON_MIGRATIONS=1 — exiting."
      exit "$status"
    else
      echo "[ENTRYPOINT] Ignoring migration error and starting app to allow console access."
    fi
  fi
else
  echo "[ENTRYPOINT] SKIP_MIGRATIONS=1 — skipping migrations."
fi

# 3) Старт бота
echo "[ENTRYPOINT] Starting bot..."
exec python -m app.main

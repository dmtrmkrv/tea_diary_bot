# Tea Diary Bot

## Environment variables

Configure the following variables (see `.env.example`) when deploying to Timeweb Cloud:

- `BOT_TOKEN`
- `APP_ENV`
- `TZ`
- `POSTGRESQL_HOST`
- `POSTGRESQL_PORT`
- `POSTGRESQL_DBNAME`
- `POSTGRESQL_USER`
- `POSTGRESQL_PASSWORD`
- `POSTGRESQL_SSLMODE`
- `ADMINS`
- `MEDIA_BACKEND`
- `S3_ENDPOINT_URL`
- `S3_REGION`
- `S3_BUCKET`
- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`
- `MEDIA_DIR`

Locally, the bot falls back to `sqlite:////app/tastings.db` if the full PostgreSQL configuration is not provided.

Set `ADMINS` to a comma-, space-, or semicolon-separated list of Telegram user IDs, for example `ADMINS="12345,67890"` or `ADMINS="12345 67890"`. In production (`APP_ENV=production`) this variable must be populated; otherwise, diagnostic commands that expose database status will be disabled.

### Media storage

Media files are stored locally by default. Set `MEDIA_BACKEND=s3` together with the S3 configuration variables (`S3_ENDPOINT_URL`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`) to store uploads in Timeweb Cloud Object Storage. If any of these variables are missing or an S3 request fails, the bot automatically falls back to the local backend.

For local storage you can override the root directory with `MEDIA_DIR` (default: `/app/media`).

## Running

Apply migrations and start the bot:

```bash
alembic upgrade head
python -m app.main
```

In the Timeweb logs you should see Alembic migrations running, then `[DB] OK`, and finally `Start polling` once the bot is ready to accept updates.

## Timeweb Cloud deployment

Timeweb builds the image using the repo's Dockerfile and runs migrations automatically through `entrypoint.sh`, so container logs show the Alembic upgrade (`Running upgrade ... -> head`), `[DB] OK`, and then the bot startup without needing to configure a manual start command.

- **Environment variables**

  ```
  BOT_TOKEN=...
  POSTGRESQL_HOST=10.20.0.4
  POSTGRESQL_PORT=5432
  POSTGRESQL_DBNAME=default_db
  POSTGRESQL_USER=gen_user
  POSTGRESQL_PASSWORD=...
  POSTGRESQL_SSLMODE=disable
  APP_ENV=production
  ADMINS=12345,67890
  TZ=Europe/Amsterdam
  ```

## Диагностика

### Продакшн

- Если `ADMINS` пуст — диагностические команды отключены (fail-closed).
- Если `ADMINS` заполнен — подключается роутер с публичной `/whoami` и админскими `/dbinfo`, `/health`. В ответе `/dbinfo` пароль скрывается.

### Дев

- Диагностический роутер подключается всегда.
- Команды `/dbinfo` и `/health` доступны только администраторам, а `/whoami` остаётся публичной.
- Дополнительные дев-эндпоинты из `app/handlers/health.py` не подключаются в продакшн окружении.

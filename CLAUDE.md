# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the bot

```bash
# Apply migrations and start
alembic upgrade head
python -m app.main
```

Locally, if no PostgreSQL env vars are set, the bot automatically uses SQLite at `/app/tastings.db`. Set `BOT_TOKEN` (required) and optionally create a `.env` file — it is loaded automatically in non-production environments.

## Environment

Key env vars: `BOT_TOKEN`, `APP_ENV` (`production` or dev), `TZ`, PostgreSQL vars (`POSTGRESQL_HOST/PORT/DBNAME/USER/PASSWORD/SSLMODE`), `ADMINS` (comma/space/semicolon-separated Telegram user IDs), `MEDIA_BACKEND` (`local` or `s3`), S3 vars, SMTP vars for password-reset email (`SMTP_HOST/PORT/USER/PASSWORD`, optional `SMTP_FROM`).

`APP_ENV` is not set → dev mode: `.env` is loaded, diagnostics router is always attached.  
`APP_ENV=production` → `.env` is skipped; diagnostics disabled if `ADMINS` is empty.

## Migrations

```bash
alembic upgrade head          # apply all
alembic revision --autogenerate -m "description"  # create new migration
```

Migration files are in `alembic/versions/`.

## Architecture

**Single-file bot logic**: Nearly all Telegram handlers, FSM state machines, inline keyboards, and UI constants live in `app/main.py` (~1500+ lines). This is intentional — do not split it without a clear reason.

**FSM state groups** (defined in `app/main.py`):
- `TastingStates` — full multi-step tasting entry flow
- `QuickStates` — fast "quick note" entry flow  
- `SearchStates` — tasting search/filter flow

**Entry modes**: A `Tasting` record has `entry_mode` field: `"full"` (detailed tasting) or `"quick"` (quick note). The quick flow uses `QUICK_*` constants for inline category/gear/temp/effects pickers.

**Services** (`app/services/`):
- `tastings.py` — `create_tasting()` handles seq_no assignment with retry on race condition
- `users.py` — `get_or_create_user()`, `set_user_timezone()`
- `storage.py` — photo save/delete with local or S3 backend; falls back to local on S3 error
- `stats.py` — aggregate bot stats for admin

**Keyboards**: `app/ui/keyboards.py` contains only `skip_inline_kb()`. All other keyboards (main menu, category pickers, rating, etc.) are defined as functions inside `app/main.py`.

**Diagnostics router** (`app/routers/diagnostics.py`): `/whoami` (public), `/dbinfo` and `/health` (admin-only). Router is created via `create_router(admin_ids, is_prod)` and attached in `app/main.py`.

**DB**: SQLAlchemy 2.0 sync sessions via `SessionLocal` context manager from `app/db/engine.py`. Models: `User`, `Tasting`, `Infusion`, `Photo`. Tastings are numbered per-user via `seq_no` (unique index `ux_tastings_user_seq`). Users reference tastings by `#<seq_no>` (e.g. `#42`).

**Photo storage**: Photos are downloaded from Telegram and stored either locally (`MEDIA_DIR`, default `/app/media`) or in S3. The `Photo` model tracks `storage_backend`, `object_key`, `telegram_file_id`.

**Deployment**: Timeweb Cloud Docker deploy via `Dockerfile` + `entrypoint.sh`. The entrypoint runs Alembic migrations, then starts the FastAPI server (uvicorn :8000) and the bot in one container. `DISABLE_BOT=1` runs API only (staging); `MAINTENANCE=1` skips everything and keeps the container alive for console access. Prod deploys only from `main`, staging from `staging`; redeploys are manual (backend first, then frontend).

## Web app (API + frontend)

**API** (`app/api/`): FastAPI routers in `app/api/routers/` + `auth_router.py`. Every authenticated route depends on `get_current_user_id` (`app/api/auth.py`): Bearer JWT, rejects single-purpose tokens (`purpose` claim), and checks the `tv` claim against `users.token_version` in the DB on every request — bumping `token_version` (password change/reset) instantly revokes all sessions of a user.

**Auth model**: one `User` row with optional identifiers — `telegram_id`, `email`+`password_hash` (argon2id), `yandex_id`. Login = email+password or Yandex OAuth; Telegram is only a one-time in-app claim (merges bot records into the account). Password reset by email: `password_resets` table stores SHA-256 hashes of one-time tokens (TTL 1 h); reset revokes all sessions. Account deletion (`DELETE /users/me`) requires the current password, or for OAuth-only accounts a 5-minute re-auth proof from `/auth/yandex/reauth` / `/auth/telegram/reauth`.

**Frontend** (`frontend/`, Next.js App Router, SSR): before writing any code read `frontend/AGENTS.md` — the Next.js version differs from training data. The session is a JWT in an **HttpOnly cookie `token`**; the token must never be read or written in client JS. All browser requests go same-origin through the BFF proxy `frontend/app/api/[...path]/route.ts`, which reads the cookie, attaches `Authorization: Bearer`, forwards to the backend (`API_URL` env, falls back to staging), forwards `X-Forwarded-For` (rate limiting depends on it), and intercepts `access_token`/`reauth_token` from auth responses into HttpOnly cookies. `frontend/proxy.ts` (middleware) gates routes by cookie presence; `lib/api.ts` = server-side fetch (reads the cookie via `cookies()`), `lib/apiClient.ts` = client fetch through `/api`.

**Rate limiting** (`app/api/ratelimit.py`): slowapi keyed by the first `X-Forwarded-For` address + an in-memory per-email failed-login counter (single uvicorn worker by design).

**Mail** (`app/services/mailer.py`): SMTP via `SMTP_*` env — port 465 = implicit SSL, anything else = STARTTLS. Note: outbound SMTP ports on Timeweb Apps are blocked by default; support unblocked them for both staging and prod apps.

## Язык общения
Всегда отвечай на русском языке.

## Контекст проекта
Это Telegram-бот для записей чайных дегустаций (TeaNotesBot).
Бот используется реальными пользователями (~50 человек) в продакшне.
Любые изменения сначала тестируются в ветке staging, потом merge в main.

## Стиль работы
- Объясняй изменения простым языком, без сложных терминов
- Перед любым изменением в БД (новые поля, таблицы) — создавай Alembic-миграцию
- Не трогай существующие FSM-флоу без явной просьбы
- Коммиты делай с понятными описаниями на русском
# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

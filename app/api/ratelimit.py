"""Rate limiting для auth-ручек.

Один воркер uvicorn (см. entrypoint.sh) → счётчики держим в памяти процесса:
точно и без Redis. Два механизма:
- slowapi (limiter) — лимиты по IP на публичные auth-POST (флуд/спам-регистрации/
  подвешивание воркера). Best-effort: за прокси IP — приблизительная мера.
- email-счётчик неудачных входов — спуф-устойчивая защита от перебора пароля
  конкретного аккаунта (не обходится сменой IP). Это основная защита входа.
"""

from __future__ import annotations

import threading
import time

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address


def client_ip(request: Request) -> str:
    """Реальный IP посетителя. За прокси Timeweb он в X-Forwarded-For (первый
    адрес); иначе всё пришло бы с одного IP прокси и лимит бил бы по всем сразу.
    """
    xff = request.headers.get("x-forwarded-for")
    if xff:
        first = xff.split(",")[0].strip()
        if first:
            return first
    return get_remote_address(request)


limiter = Limiter(key_func=client_ip)


# --- Счётчик неудачных попыток входа по email (спуф-устойчивый) ---

_FAIL_WINDOW_SEC = 300  # окно 5 минут
_FAIL_MAX = 5  # столько неудач на email в окне → временная пауза

_fail_lock = threading.Lock()
_login_fails: dict[str, list[float]] = {}


def _recent(attempts: list[float], now: float) -> list[float]:
    return [t for t in attempts if now - t < _FAIL_WINDOW_SEC]


def email_login_blocked(email: str) -> bool:
    """True, если по этому email уже превышен лимит неудачных попыток."""
    now = time.time()
    key = email.strip().lower()
    with _fail_lock:
        attempts = _recent(_login_fails.get(key, []), now)
        _login_fails[key] = attempts
        return len(attempts) >= _FAIL_MAX


def register_login_failure(email: str) -> None:
    """Фиксирует неудачную попытку входа по email."""
    now = time.time()
    key = email.strip().lower()
    with _fail_lock:
        attempts = _recent(_login_fails.get(key, []), now)
        attempts.append(now)
        _login_fails[key] = attempts


def clear_login_failures(email: str) -> None:
    """Сбрасывает счётчик после успешного входа."""
    with _fail_lock:
        _login_fails.pop(email.strip().lower(), None)

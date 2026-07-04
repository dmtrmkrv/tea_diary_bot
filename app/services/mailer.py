"""Отправка почты через SMTP (доменная почта Timeweb, noreply@leafpulse.ru).

Настройки — env: SMTP_HOST, SMTP_PORT (465, SSL), SMTP_USER, SMTP_PASSWORD,
SMTP_FROM (опционально, по умолчанию = SMTP_USER). Без них отправка
недоступна — ручки, которым нужна почта, отвечают 503.
"""

from __future__ import annotations

import logging
import os
import smtplib
import ssl
from email.message import EmailMessage

logger = logging.getLogger(__name__)


def is_configured() -> bool:
    return bool(
        os.getenv("SMTP_HOST") and os.getenv("SMTP_USER") and os.getenv("SMTP_PASSWORD")
    )


def send_email(to: str, subject: str, text: str) -> None:
    """Синхронная отправка одного письма (plain text). Бросает исключение
    при ошибке — вызывающий решает, глотать её (фон) или нет."""
    host = os.getenv("SMTP_HOST", "")
    port = int(os.getenv("SMTP_PORT", "465"))
    user = os.getenv("SMTP_USER", "")
    password = os.getenv("SMTP_PASSWORD", "")
    sender = os.getenv("SMTP_FROM", user)

    msg = EmailMessage()
    msg["From"] = f"LeafPulse <{sender}>"
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(text)

    with smtplib.SMTP_SSL(host, port, context=ssl.create_default_context(), timeout=20) as smtp:
        smtp.login(user, password)
        smtp.send_message(msg)


def send_email_background(to: str, subject: str, text: str) -> None:
    """Для BackgroundTasks: ошибка отправки не должна ронять запрос —
    логируем и живём (юзер запросит ссылку повторно)."""
    try:
        send_email(to, subject, text)
    except Exception:
        logger.exception("Не удалось отправить письмо на %s", to)

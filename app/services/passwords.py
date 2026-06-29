"""Хеширование паролей (argon2id)."""

from __future__ import annotations

from argon2 import PasswordHasher
from argon2.exceptions import Argon2Error

_ph = PasswordHasher()


def hash_password(password: str) -> str:
    return _ph.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    """True, если пароль подходит. Любая ошибка хеша/несовпадение → False."""
    try:
        return _ph.verify(password_hash, password)
    except Argon2Error:
        return False

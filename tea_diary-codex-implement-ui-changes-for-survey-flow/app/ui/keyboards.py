"""Inline keyboard helpers."""

from aiogram.types import InlineKeyboardMarkup
from aiogram.utils.keyboard import InlineKeyboardBuilder


def skip_inline_kb(tag: str) -> InlineKeyboardMarkup:
    """Build inline keyboard with a single "Skip" button."""
    kb = InlineKeyboardBuilder()
    kb.button(text="Пропустить", callback_data=f"skip:{tag}")
    kb.adjust(1)
    return kb.as_markup()

import asyncio
import base64
import datetime
import html
import math
import io
import logging
import os
import re
import time
from contextlib import suppress
from typing import Any, Awaitable, Callable, Dict, List, Optional, Tuple, TypedDict, Union

from aiogram import Bot, Dispatcher, F
from aiogram.filters import CommandStart, Command, StateFilter
from aiogram.types import (
    Message, CallbackQuery, BotCommand,
    ReplyKeyboardMarkup, KeyboardButton, ReplyKeyboardRemove, FSInputFile,
    InputMediaPhoto, InlineKeyboardMarkup, InlineKeyboardButton,
)
from aiogram.utils.keyboard import InlineKeyboardBuilder
    # fmt: off
from aiogram.fsm.state import StatesGroup, State
from aiogram.fsm.context import FSMContext
from aiogram.exceptions import TelegramBadRequest

from sqlalchemy import func, select

from app.config import get_bot_token, get_db_url
from app.db.engine import SessionLocal, create_sa_engine, startup_ping
from app.db.models import Infusion, Photo, Tasting, User
from app.routers.diagnostics import create_router
from app.utils.admins import get_admin_ids
from app.services.stats import get_bot_stats, get_user_stats
from app.services.tastings import create_tasting
from app.services.users import get_or_create_user, set_user_timezone
from app.validators import parse_float, parse_int
# fmt: on

# ---------------- ЛОГИ ----------------

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

IS_PROD = os.getenv("APP_ENV") == "production"
ADMINS = get_admin_ids()
DIAGNOSTICS_ENABLED = not (IS_PROD and not ADMINS)


# ---------------- ЧАСОВОЙ ПОЯС ----------------

TZ_OFFSET_PATTERN = re.compile(
    r"^(?P<sign>[+-])?(?P<hours>\d{1,2})(?:(?P<sep>[:.])(?P<minutes>\d{1,2}))?$"
)
TZ_OFFSET_ERROR = (
    "Формат: /tz +3, /tz -2, /tz +5:30. Допустимы только целые часы или :30. "
    "Диапазон UTC−12…UTC+14."
)


def get_user_now_hm(uid: int) -> str:
    u = get_or_create_user(uid)
    off = u.tz_offset_min or 0
    now_utc = datetime.datetime.utcnow()
    local_dt = now_utc + datetime.timedelta(minutes=off)
    return local_dt.strftime("%H:%M")


def parse_tz_offset(raw: str) -> int:
    text = (raw or "").strip()
    if not text:
        raise ValueError

    lowered = text.casefold()
    if lowered.startswith("utc"):
        lowered = lowered[3:].strip()

    match = TZ_OFFSET_PATTERN.fullmatch(lowered)
    if not match:
        raise ValueError

    sign = match.group("sign") or "+"
    hours = int(match.group("hours"))
    sep = match.group("sep")
    minutes_token = match.group("minutes") or ""
    minutes = 0

    if sep:
        if sep == ":":
            if minutes_token != "30":
                raise ValueError
            minutes = 30
        elif sep == ".":
            if minutes_token not in {"5"}:
                raise ValueError
            minutes = 30
        else:
            raise ValueError
    elif minutes_token:
        raise ValueError

    if sign == "+" and hours == 14 and minutes:
        raise ValueError
    if sign == "-" and hours == 12 and minutes:
        raise ValueError

    offset = hours * 60 + minutes
    if sign == "-":
        offset = -offset

    if offset < -12 * 60 or offset > 14 * 60:
        raise ValueError

    return offset


def format_tz_offset(offset_min: int) -> str:
    sign = "+" if offset_min >= 0 else "-"
    minutes_abs = abs(offset_min)
    hours, minutes = divmod(minutes_abs, 60)
    if minutes:
        return f"UTC{sign}{hours}:{minutes:02d}"
    return f"UTC{sign}{hours}"


def resolve_tasting(uid: int, identifier: str) -> Optional[Tasting]:
    token = (identifier or "").strip()
    if not token:
        return None
    with SessionLocal() as s:
        if token.startswith("#"):
            seq_part = token[1:]
            if not seq_part.isdigit():
                return None
            seq_no = int(seq_part)
            return (
                s.execute(
                    select(Tasting).where(
                        Tasting.user_id == uid, Tasting.seq_no == seq_no
                    )
                )
                .scalars()
                .first()
            )
        if not token.isdigit():
            return None
        tasting = s.get(Tasting, int(token))
        if tasting and tasting.user_id == uid:
            return tasting
        return None


# ---------------- КОНСТАНТЫ UI ----------------

CATEGORIES = ["Зелёный", "Белый", "Красный", "Улун", "Шу пуэр", "Шен пуэр", "Хэй ча", "Другое"]
BODY_PRESETS = ["тонкое", "лёгкое", "среднее", "плотное", "маслянистое"]

YEAR_MIN = 1900
GRAMS_ERROR = "Граммовка от 0.1 до 50 г (например, 3.5)."
TEMP_ERROR = "Температура от 40 до 100 °C."

EFFECTS = [
    "Тепло",
    "Охлаждение",
    "Расслабление",
    "Фокус",
    "Бодрость",
    "Тонус",
    "Спокойствие",
    "Сонливость",
]

SCENARIOS = [
    "Отдых",
    "Работа/учеба",
    "Творчество",
    "Медитация",
    "Общение",
    "Прогулка",
]

DESCRIPTORS = [
    "сухофрукты",
    "мёд",
    "хлебные",
    "цветы",
    "орех",
    "древесный",
    "дымный",
    "ягоды",
    "фрукты",
    "травянистый",
    "овощные",
    "пряный",
    "землистый",
]

AFTERTASTE_SET = [
    "сладкий",
    "фруктовый",
    "ягодный",
    "цветочный",
    "цитрусовый",
    "кондитерский",
    "хлебный",
    "древесный",
    "пряный",
    "горький",
    "минеральный",
    "овощной",
    "землистый",
]

QUICK_CATEGORIES = {
    "green": "Зелёный",
    "white": "Белый",
    "oolong": "Улун",
    "red": "Красный",
    "shu": "Шу пуэр",
    "shen": "Шен пуэр",
    "hei": "Хэй ча",
}

QUICK_CATEGORY_FALLBACK = "Другое"

QUICK_GEAR = {
    "gaiwan": "Гайвань",
    "teapot": "Чайник",
    "teapot2": "Типот",
    "flask": "Колба",
}

QUICK_TEMPS = [(75, 80), (80, 85), (85, 90), (90, 95), (95, 100)]

QUICK_EFFECTS = {
    "warm": "Тепло",
    "relax": "Расслабление",
    "calm": "Спокойствие",
    "focus": "Фокус",
    "energy": "Бодрость",
    "tone": "Тонус",
}

PAGE_SIZE = 5
NOTES_TITLE_MAX_LEN = 40
try:
    MAX_PHOTOS = max(1, int(os.getenv("PHOTO_LIMIT", "3")))
except ValueError:
    MAX_PHOTOS = 3
CAPTION_LIMIT = 1024
MESSAGE_LIMIT = 4096
ALBUM_TIMEOUT = 2.0
ALBUM_BUFFER: Dict[Tuple[int, str], dict] = {}
MORE_THROTTLE: Dict[int, float] = {}
MORE_THROTTLE_INTERVAL = 1.0


class PhotoDraft(TypedDict):
    body: bytes
    filename_hint: str
    telegram_file_id: str
    telegram_file_unique_id: str


# ---------------- КЛАВИАТУРЫ ----------------

def main_kb() -> InlineKeyboardBuilder:
    kb = InlineKeyboardBuilder()
    kb.button(text="📝 Новая дегустация", callback_data="new")
    kb.button(text="⚡ Быстрая заметка", callback_data="q:new")
    kb.button(text="Мои дегустации", callback_data="notes:list:0")
    kb.button(text="🔎 Поиск", callback_data="find")
    kb.button(text="❔ Помощь", callback_data="help")
    kb.adjust(1, 1, 1, 1, 1)
    return kb


def reply_main_kb() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [
                KeyboardButton(text="📝 Новая дегустация"),
                KeyboardButton(text="⚡ Быстрая заметка"),
            ],
            [
                KeyboardButton(text="🔎 Поиск"),
                KeyboardButton(text="🕔 Последние 5"),
            ],
            [KeyboardButton(text="Мои дегустации")],
            [KeyboardButton(text="❔ Помощь")],
            [KeyboardButton(text="Сброс")],
        ],
        resize_keyboard=True,
        input_field_placeholder="Выбери действие",
    )


def q_cancel_only_kb() -> InlineKeyboardBuilder:
    kb = InlineKeyboardBuilder()
    kb.button(text="Отмена", callback_data="q:cancel")
    kb.adjust(1)
    return kb


def q_nav_kb(
    can_back: bool, can_skip: bool, skip_step: str | None = None, skip_text: str = "Пропустить"
) -> InlineKeyboardBuilder:
    kb = InlineKeyboardBuilder()
    if can_back:
        kb.button(text="⬅️ Назад", callback_data="q:back")
    if can_skip and skip_step:
        kb.button(text=skip_text, callback_data=f"q:skip:{skip_step}")
    kb.button(text="Отмена", callback_data="q:cancel")
    kb.adjust(2, 1)
    return kb


def q_type_kb() -> InlineKeyboardBuilder:
    kb = InlineKeyboardBuilder()
    for code, label in QUICK_CATEGORIES.items():
        kb.button(text=label, callback_data=f"q:type:{code}")
    kb.button(text="Другое (ввести)", callback_data="q:type:other")
    nav = q_nav_kb(can_back=False, can_skip=True, skip_step="type", skip_text="Не знаю")
    kb.attach(nav)
    kb.adjust(2, 2, 2, 2)
    return kb


def q_temp_kb() -> InlineKeyboardBuilder:
    kb = InlineKeyboardBuilder()
    for lo, hi in QUICK_TEMPS:
        kb.button(text=f"{lo}–{hi} °C", callback_data=f"q:temp:{hi}")
    nav = q_nav_kb(can_back=True, can_skip=True, skip_step="temp")
    kb.attach(nav)
    kb.adjust(2, 2, 1)
    return kb


def q_gear_kb() -> InlineKeyboardBuilder:
    kb = InlineKeyboardBuilder()
    for code, label in QUICK_GEAR.items():
        kb.button(text=label, callback_data=f"q:gear:{code}")
    kb.button(text="Другое (ввести)", callback_data="q:gear:other")
    nav = q_nav_kb(can_back=True, can_skip=True, skip_step="gear")
    kb.attach(nav)
    kb.adjust(2, 2, 1)
    return kb


def q_effects_kb(selected: list[str]) -> InlineKeyboardBuilder:
    kb = InlineKeyboardBuilder()
    selected_set = {item.strip() for item in selected}
    for code, label in QUICK_EFFECTS.items():
        prefix = "✅ " if label in selected_set else ""
        kb.button(text=f"{prefix}{label}", callback_data=f"q:eff:{code}")
    kb.button(text="Другое (ввести)", callback_data="q:eff:other")
    kb.button(text="ГОТОВО", callback_data="q:eff:done")
    kb.button(text="⬅️ Назад", callback_data="q:back")
    kb.button(text="Пропустить", callback_data="q:skip:eff")
    kb.button(text="Отмена", callback_data="q:cancel")
    kb.adjust(2, 2, 2, 1, 1, 2, 1)
    return kb


def q_rating_kb() -> InlineKeyboardBuilder:
    kb = InlineKeyboardBuilder()
    for val in range(0, 11):
        kb.button(text=str(val), callback_data=f"q:rate:{val}")
    kb.button(text="⬅️ Назад", callback_data="q:back")
    kb.button(text="Отмена", callback_data="q:cancel")
    kb.adjust(6, 5, 2)
    return kb


def q_cancel_confirm_kb() -> InlineKeyboardBuilder:
    kb = InlineKeyboardBuilder()
    kb.button(text="Да, отменить", callback_data="q:cancel:yes")
    kb.button(text="Вернуться к заполнению", callback_data="q:cancel:no")
    kb.adjust(1, 1)
    return kb


CANCEL_CONFIRM_TEXT = "Отменить все изменения и вернуться в меню?"


def category_kb() -> InlineKeyboardBuilder:
    kb = InlineKeyboardBuilder()
    for c in CATEGORIES:
        kb.button(text=c, callback_data=f"cat:{c}")
    kb.adjust(2)
    return kb


def category_search_kb() -> InlineKeyboardBuilder:
    kb = InlineKeyboardBuilder()
    for c in CATEGORIES:
        kb.button(text=c, callback_data=f"scat:{c}")
    kb.button(text="Другая категория (ввести)", callback_data="scat:__other__")
    kb.adjust(2)
    return kb


def skip_kb(tag: str) -> InlineKeyboardBuilder:
    kb = InlineKeyboardBuilder()
    kb.button(text="Пропустить", callback_data=f"skip:{tag}")
    kb.adjust(1)
    return kb


def back_skip_kb(tag: str) -> InlineKeyboardBuilder:
    kb = InlineKeyboardBuilder()
    kb.button(text="⬅️ Назад", callback_data="nt:back")
    kb.button(text="Пропустить", callback_data=f"skip:{tag}")
    kb.adjust(2)
    return kb


def kb_inf_seconds() -> InlineKeyboardMarkup:
    return skip_kb("infsec").as_markup()


def time_kb() -> InlineKeyboardBuilder:
    kb = InlineKeyboardBuilder()
    kb.button(text="🕒 Текущее время", callback_data="time:now")
    kb.button(text="Пропустить", callback_data="skip:tasted_at")
    kb.adjust(1, 1)
    return kb


def time_with_back_kb() -> InlineKeyboardBuilder:
    kb = InlineKeyboardBuilder()
    kb.button(text="🕒 Текущее время", callback_data="time:now")
    kb.button(text="⬅️ Назад", callback_data="nt:back")
    kb.button(text="Пропустить", callback_data="skip:tasted_at")
    kb.adjust(1, 2)
    return kb


def category_with_back_kb() -> InlineKeyboardBuilder:
    kb = InlineKeyboardBuilder()
    for c in CATEGORIES:
        kb.button(text=c, callback_data=f"cat:{c}")
    kb.button(text="⬅️ Назад", callback_data="nt:back")
    kb.adjust(2)
    return kb


def aroma_dry_kb(selected: List[str]) -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    for idx, item in enumerate(DESCRIPTORS):
        mark = "✅ " if item in selected else ""
        kb.button(text=f"{mark}{item}", callback_data=f"ad:{idx}")
    kb.button(text="Другое", callback_data="ad:other")
    kb.button(text="⬅️ Назад", callback_data="nt:back")
    kb.button(text="Готово", callback_data="ad:done")
    kb.adjust(2)
    return kb.as_markup()


def aroma_warmed_kb(selected: List[str]) -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    for idx, item in enumerate(DESCRIPTORS):
        mark = "✅ " if item in selected else ""
        kb.button(text=f"{mark}{item}", callback_data=f"aw:{idx}")
    kb.button(text="Другое", callback_data="aw:other")
    kb.button(text="⬅️ Назад", callback_data="nt:back")
    kb.button(text="Готово", callback_data="aw:done")
    kb.adjust(2)
    return kb.as_markup()


def yesno_more_infusions_kb() -> InlineKeyboardBuilder:
    kb = InlineKeyboardBuilder()
    kb.button(text="🫖 Ещё пролив", callback_data="more_inf")
    kb.button(text="✅ Завершить", callback_data="finish_inf")
    kb.adjust(2)
    return kb


def body_kb() -> InlineKeyboardBuilder:
    kb = InlineKeyboardBuilder()
    for b in BODY_PRESETS:
        kb.button(text=b, callback_data=f"body:{b}")
    kb.button(text="Другое", callback_data="body:other")
    kb.adjust(3, 2)
    return kb


def toggle_list_kb(
    source: List[str],
    selected: List[str],
    prefix: str,
    done_text="Готово",
    include_other=False,
) -> InlineKeyboardBuilder:
    kb = InlineKeyboardBuilder()
    for idx, item in enumerate(source):
        mark = "✅ " if item in selected else ""
        kb.button(text=f"{mark}{item}", callback_data=f"{prefix}:{idx}")
    if include_other:
        kb.button(text="Другое", callback_data=f"{prefix}:other")
    kb.button(text=done_text, callback_data=f"{prefix}:done")
    kb.adjust(2)
    return kb


def rating_kb() -> InlineKeyboardBuilder:
    kb = InlineKeyboardBuilder()
    for i in range(0, 11):
        kb.button(text=str(i), callback_data=f"rate:{i}")
    kb.adjust(6, 5)
    return kb


def rating_filter_kb() -> InlineKeyboardBuilder:
    kb = InlineKeyboardBuilder()
    for i in range(0, 11):
        kb.button(text=str(i), callback_data=f"frate:{i}")
    kb.adjust(6, 5)
    return kb


def search_menu_kb() -> InlineKeyboardBuilder:
    kb = InlineKeyboardBuilder()
    kb.button(text="По названию", callback_data="s_name")
    kb.button(text="По категории", callback_data="s_cat")
    kb.button(text="По году", callback_data="s_year")
    kb.button(text="По рейтингу", callback_data="s_rating")
    kb.button(text="⬅️ Назад", callback_data="back:main")
    kb.adjust(2, 2, 1)
    return kb


def open_btn_kb(t_id: int) -> InlineKeyboardBuilder:
    kb = InlineKeyboardBuilder()
    kb.button(text="Открыть", callback_data=f"open:{t_id}")
    kb.adjust(1)
    return kb


def more_btn_kb(kind: str, payload: str) -> InlineKeyboardBuilder:
    kb = InlineKeyboardBuilder()
    kb.button(text="Показать ещё", callback_data=f"more:{kind}:{payload}")
    kb.adjust(1)
    return kb


def card_actions_kb(t_id: int) -> InlineKeyboardBuilder:
    kb = InlineKeyboardBuilder()
    kb.button(text="✏️ Редактировать", callback_data=f"edit:{t_id}")
    kb.button(text="🗑️ Удалить", callback_data=f"del:{t_id}")
    kb.button(text="⬅️ Назад", callback_data="back:main")
    kb.adjust(2, 1)
    return kb


def quick_card_actions_kb(t_id: int) -> InlineKeyboardBuilder:
    kb = InlineKeyboardBuilder()
    kb.button(text="✏️ Редактировать", callback_data=f"qedit:{t_id}")
    kb.button(text="🗑️ Удалить", callback_data=f"del:{t_id}")
    kb.button(text="⬅️ В меню", callback_data="back:main")
    kb.adjust(2, 1)
    return kb


def notes_card_actions_kb(t_id: int, is_quick: bool) -> InlineKeyboardBuilder:
    kb = InlineKeyboardBuilder()
    if is_quick:
        kb.button(text="✏️ Редактировать", callback_data=f"qedit:{t_id}")
    else:
        kb.button(text="✏️ Редактировать", callback_data=f"edit:{t_id}")
    kb.button(text="🗑️ Удалить", callback_data=f"del:{t_id}")
    kb.button(text="⬅️ Назад к списку", callback_data="notes:back")
    kb.button(text="В меню", callback_data="back:main")
    kb.adjust(2, 2)
    return kb


def edit_fields_kb() -> InlineKeyboardBuilder:
    kb = InlineKeyboardBuilder()
    buttons = [
        ("Название", "name"),
        ("Год", "year"),
        ("Регион", "region"),
        ("Категория", "category"),
        ("Граммовка", "grams"),
        ("Температура", "temp_c"),
        ("Время", "tasted_at"),
        ("Посуда", "gear"),
        ("Аромат (сухой)", "aroma_dry"),
        ("Аромат (прогретый)", "aroma_warmed"),
        ("Ощущения", "effects"),
        ("Сценарии", "scenarios"),
        ("Оценка", "rating"),
        ("Заметка", "summary"),
        ("Отмена", "cancel"),
    ]
    for text, field in buttons:
        kb.button(text=text, callback_data=f"efld:{field}")
    kb.adjust(2, 2, 2, 2, 2, 2, 2, 1)
    return kb


def quick_edit_fields_kb(tid: int) -> InlineKeyboardBuilder:
    kb = InlineKeyboardBuilder()
    buttons = [
        ("Название", "name"),
        ("Тип", "category"),
        ("Граммовка", "grams"),
        ("Температура", "temp_c"),
        ("Посуда", "gear"),
        ("Аромат", "aroma_dry"),
        ("Вкус", "aroma_warmed"),
        ("Ощущения", "effects"),
        ("Оценка", "rating"),
        ("Заметка", "summary"),
    ]
    for text, field in buttons:
        kb.button(text=text, callback_data=f"qefld:{field}")
    kb.button(text="⬅️ Назад", callback_data=f"qedit:back:{tid}")
    kb.button(text="⬅️ В меню", callback_data="back:main")
    kb.adjust(2, 2, 2, 2, 2, 2)
    return kb


def edit_category_kb() -> InlineKeyboardBuilder:
    kb = InlineKeyboardBuilder()
    for c in CATEGORIES:
        kb.button(text=c, callback_data=f"ecat:{c}")
    kb.button(text="Другое (ввести)", callback_data="ecat:__other__")
    kb.button(text="⬅️ Назад", callback_data="ecat:__back__")
    kb.adjust(2, 2, 2, 2, 2)
    return kb


def edit_rating_kb() -> InlineKeyboardBuilder:
    kb = InlineKeyboardBuilder()
    for value in range(0, 11):
        kb.button(text=str(value), callback_data=f"erat:{value}")
    kb.adjust(6, 5)
    return kb


def confirm_del_kb(t_id: int) -> InlineKeyboardBuilder:
    kb = InlineKeyboardBuilder()
    kb.button(text="Да, удалить", callback_data=f"delok:{t_id}")
    kb.button(text="Отмена", callback_data=f"delno:{t_id}")
    kb.adjust(2)
    return kb


def photo_prompt_content(limit: int) -> Tuple[str, InlineKeyboardMarkup]:
    text = (
        "📷 Можешь добавить до {limit} фото. Пришли их одним или несколькими "
        "сообщениями и дождись ответа, что фото загружены. Если без фото — "
        "нажми «Пропустить»"
    ).format(limit=limit)
    markup = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="Пропустить", callback_data="skip:photos")]
        ]
    )
    return text, markup


def photo_status_markup(count: int, limit: int) -> Tuple[str, InlineKeyboardMarkup]:
    kb = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="Готово", callback_data="photos:done")]
        ]
    )
    text = (
        f"📷 Фото загружены: {count}/{limit}\n"
        "Если всё ок, нажми «Готово», чтобы продолжить."
    )
    return text, kb


async def update_photo_progress(
    message: Message,
    state: FSMContext,
    count: int,
    limit: int,
    *,
    prefix: Optional[str] = None,
    force: bool = True,
) -> None:
    data = await state.get_data()
    progress_id = data.get("progress_msg_id")

    text, markup = photo_status_markup(count, limit)
    if prefix:
        text = f"{prefix} {text}" if not prefix.endswith(" ") else f"{prefix}{text}"

    if progress_id:
        with suppress(Exception):
            await message.bot.delete_message(message.chat.id, progress_id)

    sent = await message.answer(text, reply_markup=markup)
    progress_id = sent.message_id

    await state.update_data(
        progress_msg_id=progress_id,
        photo_count=count,
        photo_limit=limit,
    )


async def clear_photo_progress(bot: Bot, chat_id: int, state: FSMContext) -> None:
    data = await state.get_data()
    progress_id = data.get("progress_msg_id")
    if progress_id:
        with suppress(Exception):
            await bot.delete_message(chat_id, progress_id)
    await state.update_data(progress_msg_id=None)


# ---------------- FSM ----------------

class NewTasting(StatesGroup):
    name = State()
    year = State()
    region = State()
    category = State()
    grams = State()
    temp_c = State()
    tasted_at = State()
    gear = State()
    aroma_dry = State()
    aroma_warmed = State()   # объединённый шаг «прогретый/промытый»


class InfusionState(StatesGroup):
    seconds = State()
    color = State()
    taste = State()
    special = State()
    body = State()
    aftertaste = State()


class EffectsScenarios(StatesGroup):
    effects = State()
    scenarios = State()


class RatingSummary(StatesGroup):
    rating = State()
    summary = State()


class PhotoFlow(StatesGroup):
    photos = State()


class SearchFlow(StatesGroup):
    name = State()
    category = State()
    year = State()


class EditFlow(StatesGroup):
    choosing = State()
    waiting_text = State()


class QuickNote(StatesGroup):
    name = State()
    type_pick = State()
    type_custom = State()
    grams = State()
    temp_pick = State()
    gear_pick = State()
    gear_custom = State()
    aroma = State()
    taste = State()
    eff_pick = State()
    eff_custom = State()
    rating = State()
    note = State()
    photos = State()


class QuickCancel(StatesGroup):
    confirm = State()


class QuickEditFlow(StatesGroup):
    choosing = State()
    waiting_text = State()


# ---------------- ХЭЛПЕРЫ UI ----------------

ZERO_WIDTH_SAFE = "\u2060"


def _safe_text(text: Optional[str]) -> str:
    normalized = (text or "").strip()
    return normalized if normalized else ZERO_WIDTH_SAFE


async def close_inline(call: CallbackQuery, status: str | None = None):
    msg = call.message
    if not msg:
        return
    txt = (getattr(msg, "caption", None) if getattr(msg, "photo", None) else msg.text) or ""
    new_txt = f"{txt}\n\n✅ {status}" if status else txt
    with suppress(Exception):
        if getattr(msg, "photo", None) or getattr(msg, "caption", None) is not None:
            await msg.edit_caption(new_txt)
        else:
            await msg.edit_text(new_txt)
    with suppress(Exception):
        await msg.edit_reply_markup()


async def ask_next(after: Union[CallbackQuery, Message], state: FSMContext, text: str, kb=None):
    data = await state.get_data()
    prev_id = data.get("live_q_id")
    bot = after.message.bot if isinstance(after, CallbackQuery) else after.bot
    chat_id = after.message.chat.id if isinstance(after, CallbackQuery) else after.chat.id
    if prev_id:
        with suppress(Exception):
            await bot.edit_message_reply_markup(chat_id=chat_id, message_id=prev_id, reply_markup=None)

    base = after.message if isinstance(after, CallbackQuery) else after
    sent = await base.answer(text, reply_markup=kb)
    await state.update_data(live_q_id=sent.message_id)
    return sent


async def ack(message: Message, text: str):
    with suppress(Exception):
        await message.answer(f"✅ {text}")


async def nt_ack(message: Message, state: FSMContext, text: str):
    sent = await message.answer(f"✅ {text}")
    data = await state.get_data()
    msgs = list(data.get("nt_step_msgs", []) or [])
    msgs.append(sent.message_id)
    await state.update_data(nt_step_msgs=msgs)


async def _nt_save_step(state: FSMContext, msg_id: int):
    data = await state.get_data()
    msgs = list(data.get("nt_step_msgs", []) or [])
    msgs.append(msg_id)
    await state.update_data(nt_step_msgs=msgs)


async def send_live_question(
    message_or_bot: Union[CallbackQuery, Message, Bot],
    chat_id: int,
    text: Optional[str],
    reply_markup=None,
    *,
    state: FSMContext,
):
    """Send a question message, replacing the previous live prompt if present."""

    if isinstance(message_or_bot, CallbackQuery):
        bot = (
            message_or_bot.message.bot
            if message_or_bot.message
            else message_or_bot.bot
        )
    elif isinstance(message_or_bot, Message):
        bot = message_or_bot.bot
    else:
        bot = message_or_bot

    data = await state.get_data()
    prev_qid = data.get("live_q_id")
    if prev_qid:
        with suppress(Exception):
            await bot.delete_message(chat_id, prev_qid)

    safe_text = _safe_text(text)
    sent = await bot.send_message(chat_id, safe_text, reply_markup=reply_markup)
    await state.update_data(live_q_id=sent.message_id)
    return sent


async def clear_live_question(
    message_or_bot: Union[CallbackQuery, Message, Bot],
    chat_id: int,
    *,
    state: FSMContext,
):
    """Remove stored live question message if it exists."""

    if isinstance(message_or_bot, CallbackQuery):
        bot = (
            message_or_bot.message.bot
            if message_or_bot.message
            else message_or_bot.bot
        )
    elif isinstance(message_or_bot, Message):
        bot = message_or_bot.bot
    else:
        bot = message_or_bot

    data = await state.get_data()
    prev_qid = data.get("live_q_id")
    if prev_qid:
        with suppress(Exception):
            await bot.delete_message(chat_id, prev_qid)
    await state.update_data(live_q_id=None)


def is_skip_input(text: Optional[str]) -> bool:
    raw = (text or "").strip()
    if not raw:
        return False
    lowered = raw.casefold()
    return lowered in {"пропустить", "/skip"}


async def ui(target: Union[CallbackQuery, Message], text: str, reply_markup=None):
    safe_text = _safe_text(text)
    try:
        if isinstance(target, CallbackQuery):
            msg = target.message
            if getattr(msg, "caption", None) is not None or getattr(msg, "photo", None):
                await msg.edit_caption(caption=safe_text, reply_markup=reply_markup)
            else:
                await msg.edit_text(safe_text, reply_markup=reply_markup)
        else:
            await target.answer(safe_text, reply_markup=reply_markup)
    except TelegramBadRequest:
        if isinstance(target, CallbackQuery):
            await target.message.answer(safe_text, reply_markup=reply_markup)
        else:
            await target.answer(safe_text, reply_markup=reply_markup)


def get_year_max_value() -> int:
    return datetime.datetime.utcnow().year + 1


def parse_year_value(raw: str) -> int:
    max_year = get_year_max_value()
    error_message = f"Укажи год числом от {YEAR_MIN} до {max_year}."
    return parse_int(raw, min_value=YEAR_MIN, max_value=max_year, error_message=error_message)


def parse_temp_value(raw: str) -> int:
    return parse_int(raw, min_value=40, max_value=100, error_message=TEMP_ERROR)


def parse_grams_value(raw: str) -> float:
    return parse_float(
        raw,
        min_value=0.1,
        max_value=50.0,
        error_message=GRAMS_ERROR,
        precision=1,
    )


async def ask_name_prompt(
    target: Union[Message, CallbackQuery], state: FSMContext
) -> None:
    await ask_next(target, state, "🍵 [1/10] Название чая?")
    await state.set_state(NewTasting.name)


async def ask_year_prompt(
    target: Union[Message, CallbackQuery], state: FSMContext
) -> None:
    await state.update_data(numpad_active=False)
    await ask_next(target, state, "📅 [2/10] Год сбора? Можно пропустить.", back_skip_kb("year").as_markup())
    await state.set_state(NewTasting.year)


async def ask_region_prompt(
    target: Union[Message, CallbackQuery], state: FSMContext
) -> None:
    await ask_next(
        target,
        state,
        "🗺️ [3/10] Регион? Можно пропустить.",
        back_skip_kb("region").as_markup(),
    )
    await state.set_state(NewTasting.region)


async def ask_category_prompt(
    target: Union[Message, CallbackQuery], state: FSMContext
) -> None:
    await ask_next(target, state, "🏷️ [4/10] Категория?", category_with_back_kb().as_markup())
    await state.set_state(NewTasting.category)


async def ask_grams_prompt(
    target: Union[Message, CallbackQuery], state: FSMContext
) -> None:
    await state.update_data(numpad_active=False)
    await ask_next(
        target,
        state,
        "⚖️ [5/10] Граммовка? Можно пропустить.",
        back_skip_kb("grams").as_markup(),
    )
    await state.set_state(NewTasting.grams)


async def ask_temp_prompt(
    target: Union[Message, CallbackQuery], state: FSMContext
) -> None:
    await state.update_data(numpad_active=False)
    await ask_next(
        target,
        state,
        "🌡️ [6/10] Температура, °C? Можно пропустить.",
        back_skip_kb("temp").as_markup(),
    )
    await state.set_state(NewTasting.temp_c)


async def ask_tasted_at_prompt(
    target: Union[Message, CallbackQuery], state: FSMContext, uid: int
) -> None:
    now_hm = get_user_now_hm(uid)
    text = (
        f"⏰ [7/10] Время дегустации? Сейчас {now_hm}. "
        "Введи ЧЧ:ММ, нажми «🕒 Текущее время» или пропусти."
    )
    await ask_next(target, state, text, time_with_back_kb().as_markup())
    await state.set_state(NewTasting.tasted_at)


async def ask_gear_prompt(
    target: Union[Message, CallbackQuery], state: FSMContext
) -> None:
    await ask_next(
        target,
        state,
        "🍶 [8/10] Посуда? Можно пропустить.",
        back_skip_kb("gear").as_markup(),
    )
    await state.set_state(NewTasting.gear)


async def skip_year_value(message: Message, state: FSMContext) -> None:
    await state.update_data(year=None, numpad_active=False)
    await ack(message, "Год: пропущено")
    await ask_region_prompt(message, state)


async def skip_year_callback(call: CallbackQuery, state: FSMContext) -> None:
    await state.update_data(year=None, numpad_active=False)
    data = await state.get_data()
    if data.get("live_q_id"):
        await _nt_save_step(state, data["live_q_id"])
    await close_inline(call, "Год: пропущено")
    await ask_region_prompt(call, state)
    await call.answer("Пропущено")


async def skip_grams_value(message: Message, state: FSMContext) -> None:
    await state.update_data(grams=None, numpad_active=False)
    await ack(message, "Граммовка: пропущено")
    await ask_temp_prompt(message, state)


async def skip_grams_callback(call: CallbackQuery, state: FSMContext) -> None:
    await state.update_data(grams=None, numpad_active=False)
    data = await state.get_data()
    if data.get("live_q_id"):
        await _nt_save_step(state, data["live_q_id"])
    await close_inline(call, "Граммовка: пропущено")
    await ask_temp_prompt(call, state)
    await call.answer("Пропущено")


async def skip_temp_value(message: Message, state: FSMContext) -> None:
    await state.update_data(temp_c=None, numpad_active=False)
    await ack(message, "Температура: пропущено")
    await ask_tasted_at_prompt(message, state, message.from_user.id)


async def skip_temp_callback(call: CallbackQuery, state: FSMContext) -> None:
    await state.update_data(temp_c=None, numpad_active=False)
    data = await state.get_data()
    if data.get("live_q_id"):
        await _nt_save_step(state, data["live_q_id"])
    await close_inline(call, "Температура: пропущено")
    await ask_tasted_at_prompt(call, state, call.from_user.id)
    await call.answer("Пропущено")




def short_row(t: Tasting) -> str:
    meta: List[str] = []
    if t.year:
        meta.append(str(t.year))
    if t.region:
        meta.append(t.region)
    suffix = f" — {' • '.join(meta)}" if meta else ""
    prefix = "⚡️ " if getattr(t, "entry_mode", "full") == "quick" else ""
    return f"{prefix}#{t.seq_no} [{t.category}] {t.name}{suffix}"


def build_card_text(
    t: Tasting,
    infusions: List[dict],
    photo_count: Optional[int] = None,
) -> str:
    def fmt_text(value: Optional[Union[str, int, float]]) -> str:
        if value is None:
            return "—"
        if isinstance(value, str):
            if not value.strip():
                return "—"
            return html.escape(value)
        if isinstance(value, float):
            return html.escape(f"{value:g}")
        return html.escape(str(value))

    def fmt_seconds(value: Optional[Union[str, int]]) -> str:
        if value is None:
            return "— сек"
        return html.escape(f"{value} сек")

    lines = [f"<b>#{t.seq_no} {html.escape(t.title)}</b>"]
    lines.append(f"⭐ Оценка: {t.rating}")
    if t.grams is not None:
        lines.append(f"⚖️ Граммовка: {fmt_text(t.grams)} г")
    if t.temp_c is not None:
        lines.append(f"🌡️ Температура: {fmt_text(t.temp_c)} °C")
    if t.tasted_at:
        lines.append(f"⏰ Время дегустации: {fmt_text(t.tasted_at)}")
    if t.gear:
        lines.append(f"🍶 Посуда: {fmt_text(t.gear)}")

    if t.aroma_dry or t.aroma_warmed:
        lines.append("🌬️ Ароматы:")
        if t.aroma_dry:
            lines.append(f"  ▫️ сухой лист: {fmt_text(t.aroma_dry)}")
        if t.aroma_warmed:
            lines.append(f"  ▫️ прогретый/промытый лист: {fmt_text(t.aroma_warmed)}")

    if t.effects_csv:
        lines.append(f"🧘 Ощущения: {fmt_text(t.effects_csv)}")
    if t.scenarios_csv:
        lines.append(f"🎯 Сценарии: {fmt_text(t.scenarios_csv)}")
    if t.summary:
        lines.append(f"📝 Заметка: {fmt_text(t.summary)}")

    if photo_count:
        lines.append(f"📷 Фото: {fmt_text(photo_count)} шт.")

    if infusions:
        lines.append("<b>🫖 Проливы:</b>")
        for inf in infusions:
            prefix = f"#{inf.get('n')}" if inf.get("n") is not None else "#?"
            color = fmt_text(inf.get("liquor_color"))
            taste = fmt_text(inf.get("taste"))
            notes = fmt_text(inf.get("special_notes"))
            body = fmt_text(inf.get("body"))
            aftertaste = fmt_text(inf.get("aftertaste"))
            seconds = fmt_seconds(inf.get("seconds"))
            line_parts = [
                f"{html.escape(prefix)}: {seconds}",
                f"<b>Цвет:</b> {color}",
                f"<b>Вкус:</b> {taste}",
                f"<b>Ноты:</b> {notes}",
                f"<b>Тело:</b> {body}",
                f"<b>Послевкусие:</b> {aftertaste}",
            ]
            lines.append("• " + "; ".join(line_parts))
    return "\n".join(lines)


def build_quick_card_text(t: Tasting, photo_count: int = 0) -> str:
    def fmt_text(value: Optional[Union[str, int, float]]) -> str:
        if value is None:
            return "—"
        if isinstance(value, str):
            if not value.strip():
                return "—"
            return html.escape(value)
        if isinstance(value, float):
            return html.escape(f"{value:g}")
        return html.escape(str(value))

    header = f"⚡️ Быстрая заметка #{t.seq_no} {html.escape(t.title)}"
    lines = [f"<b>{header}</b>"]
    lines.append(f"🏷️ Тип: {fmt_text(t.category)}")
    lines.append(f"⚖️ Граммовка: {fmt_text(t.grams)} г")
    lines.append(f"🌡️ Температура: {fmt_text(t.temp_c)} °C")
    lines.append(f"🍶 Посуда: {fmt_text(t.gear)}")
    lines.append(f"🌬️ Аромат: {fmt_text(t.aroma_dry)}")
    lines.append(f"🍬 Вкус: {fmt_text(t.aroma_warmed)}")
    lines.append(f"🧘 Ощущения: {fmt_text(t.effects_csv)}")
    lines.append(f"⭐ Оценка: {fmt_text(t.rating)}")
    if t.summary:
        lines.append(f"📝 Заметка: {fmt_text(t.summary)}")
    lines.append(f"📷 Фото: {fmt_text(photo_count)} шт.")
    return "\n".join(lines)


def split_text_for_telegram(text: str, limit: int = MESSAGE_LIMIT) -> List[str]:
    if len(text) <= limit:
        return [text]

    parts: List[str] = []
    current = ""
    for paragraph in text.split("\n\n"):
        paragraph = paragraph.strip()
        if not paragraph:
            continue
        candidate = f"{current}\n\n{paragraph}" if current else paragraph
        if len(candidate) <= limit:
            current = candidate
            continue
        if current:
            parts.append(current)
            current = ""
        if len(paragraph) <= limit:
            current = paragraph
            continue
        for i in range(0, len(paragraph), limit):
            parts.append(paragraph[i : i + limit])
    if current:
        parts.append(current)
    if not parts:
        return [text[:limit]]
    # ensure each chunk is within limit by splitting on newlines if needed
    final_parts: List[str] = []
    for chunk in parts:
        if len(chunk) <= limit:
            final_parts.append(chunk)
            continue
        buf = ""
        for line in chunk.split("\n"):
            line = line.strip()
            if not line:
                addition = ""
            else:
                addition = (buf + "\n" + line) if buf else line
            if addition and len(addition) > limit:
                if buf:
                    final_parts.append(buf)
                for i in range(0, len(line), limit):
                    final_parts.append(line[i : i + limit])
                buf = ""
            else:
                buf = addition
        if buf:
            final_parts.append(buf)
    return final_parts or [text[:limit]]


FIELD_LABELS = {
    "name": "Название",
    "year": "Год",
    "region": "Регион",
    "category": "Категория",
    "grams": "Граммовка",
    "temp_c": "Температура",
    "tasted_at": "Время",
    "gear": "Посуда",
    "aroma_dry": "Аромат (сухой)",
    "aroma_warmed": "Аромат (прогретый)",
    "effects": "Ощущения",
    "scenarios": "Сценарии",
    "rating": "Оценка",
    "summary": "Заметка",
}


EDIT_TEXT_FIELDS = {
    "name": {
        "prompt": "Пришли новое название.",
        "allow_clear": False,
        "column": "name",
    },
    "year": {
        "prompt": "Пришли год (4 цифры) или «-» чтобы очистить.",
        "allow_clear": True,
        "column": "year",
    },
    "region": {
        "prompt": "Пришли регион или «-» чтобы очистить.",
        "allow_clear": True,
        "column": "region",
    },
    "grams": {
        "prompt": "Пришли граммовку (число) или «-».",
        "allow_clear": True,
        "column": "grams",
    },
    "temp_c": {
        "prompt": "Пришли температуру (°C) или «-».",
        "allow_clear": True,
        "column": "temp_c",
    },
    "tasted_at": {
        "prompt": "Пришли время в формате HH:MM или «-».",
        "allow_clear": True,
        "column": "tasted_at",
    },
    "gear": {
        "prompt": "Пришли посуду или «-».",
        "allow_clear": True,
        "column": "gear",
    },
    "aroma_dry": {
        "prompt": "Пришли аромат сухого листа или «-».",
        "allow_clear": True,
        "column": "aroma_dry",
    },
    "aroma_warmed": {
        "prompt": "Пришли аромат прогретого/промытого листа или «-».",
        "allow_clear": True,
        "column": "aroma_warmed",
    },
    "effects": {
        "prompt": "Пришли ощущения через запятую или «-».",
        "allow_clear": True,
        "column": "effects_csv",
    },
    "scenarios": {
        "prompt": "Пришли сценарии через запятую или «-».",
        "allow_clear": True,
        "column": "scenarios_csv",
    },
    "summary": {
        "prompt": "Пришли заметку или «-».",
        "allow_clear": True,
        "column": "summary",
    },
}


def edit_menu_text(seq_no: int) -> str:
    return f"Редактирование #{seq_no}. Выбери поле."


def normalize_csv_text(raw: str) -> str:
    parts = [piece.strip() for piece in raw.split(",")]
    filtered = [p for p in parts if p]
    return ", ".join(filtered)


async def send_card_with_media(
    target_message: Message,
    tasting_id: int,
    text_card: str,
    photos: List[str],
    reply_markup=None,
    *,
    collect_message_ids: bool = False,
) -> Optional[Tuple[List[int], Optional[int]]]:
    bot = target_message.bot
    chat_id = target_message.chat.id
    photos = photos[:MAX_PHOTOS]
    markup_sent = False
    message_ids: List[int] = []
    actions_message_id: Optional[int] = None

    async def send_text_chunks(text: str) -> None:
        nonlocal markup_sent, actions_message_id
        if not text:
            return
        chunks = split_text_for_telegram(text, MESSAGE_LIMIT)
        for idx, chunk in enumerate(chunks):
            msg = await bot.send_message(
                chat_id,
                chunk,
                parse_mode="HTML",
                reply_markup=(reply_markup if not markup_sent and reply_markup and idx == 0 else None),
            )
            if collect_message_ids:
                message_ids.append(msg.message_id)
                if reply_markup and not markup_sent and idx == 0:
                    actions_message_id = msg.message_id
            if reply_markup and not markup_sent and idx == 0:
                markup_sent = True

    async def ensure_actions_message() -> None:
        nonlocal markup_sent, actions_message_id
        if reply_markup and not markup_sent:
            msg = await bot.send_message(
                chat_id,
                "Действия:",
                reply_markup=reply_markup,
            )
            if collect_message_ids:
                message_ids.append(msg.message_id)
                actions_message_id = msg.message_id
            markup_sent = True

    try:
        if photos:
            use_caption = len(text_card) <= CAPTION_LIMIT and bool(text_card)
            media: List[InputMediaPhoto] = []
            for idx, fid in enumerate(photos):
                if idx == 0 and use_caption:
                    media.append(
                        InputMediaPhoto(
                            media=fid,
                            caption=text_card,
                            parse_mode="HTML",
                        )
                    )
                else:
                    media.append(InputMediaPhoto(media=fid))
            sent_album = await bot.send_media_group(chat_id, media)
            if collect_message_ids:
                message_ids.extend(m.message_id for m in sent_album)
            if use_caption:
                await ensure_actions_message()
            else:
                await send_text_chunks(text_card)
                await ensure_actions_message()
        else:
            await send_text_chunks(text_card)
            await ensure_actions_message()
    except Exception:
        logging.exception("Failed to send media group for tasting %s", tasting_id)
        await send_text_chunks(text_card)
        await ensure_actions_message()
        for fid in photos:
            try:
                msg = await bot.send_photo(chat_id, fid)
                if collect_message_ids:
                    message_ids.append(msg.message_id)
            except Exception:
                logging.exception(
                    "Fallback photo send failed for tasting %s", tasting_id
                )
    if collect_message_ids:
        return message_ids, actions_message_id
    return None


async def _store_photo_from_file_id(
    message: Message,
    state: FSMContext,
    file_id: str,
    photos: List[PhotoDraft],
    *,
    file_unique_id: Optional[str] = None,
) -> bool:
    try:
        tg_file = await message.bot.get_file(file_id)
    except Exception:
        logger.exception("Failed to get Telegram file %s", file_id)
        await message.answer("Не удалось получить файл из Telegram. Попробуйте ещё раз.")
        return False

    file_path = getattr(tg_file, "file_path", None) or ""
    filename_hint = os.path.basename(file_path) or "photo.jpg"

    buffer = io.BytesIO()
    try:
        await message.bot.download_file(file_path, buffer)
    except Exception:
        logger.exception("Failed to download Telegram file %s", file_id)
        await message.answer("Не удалось скачать фото. Попробуйте ещё раз.")
        return False

    body = buffer.getvalue()

    photos.append(
        {
            "body": body,
            "filename_hint": filename_hint,
            "telegram_file_id": file_id,
            "telegram_file_unique_id": file_unique_id or file_id,
        }
    )
    await state.update_data(new_photos=photos)
    return True


async def _process_album_entry(entry: dict) -> None:
    state: Optional[FSMContext] = entry.get("state")
    message: Optional[Message] = entry.get("message")
    files: List[dict] = entry.get("files", [])
    if not state or not message or not files:
        return
    try:
        data = await state.get_data()
    except Exception:
        return
    photos: List[PhotoDraft] = list(data.get("new_photos", []) or [])
    limit = int(data.get("photo_limit", MAX_PHOTOS))
    progress_present = data.get("progress_msg_id") is not None
    capacity = limit - len(photos)
    if capacity <= 0:
        await update_photo_progress(
            message,
            state,
            len(photos),
            limit,
            force=progress_present,
        )
        return

    accepted: List[dict] = files[:capacity]
    extra = len(files) - len(accepted)
    saved_any = False
    for file_entry in accepted:
        file_id = file_entry.get("file_id")
        if not file_id:
            continue
        if await _store_photo_from_file_id(
            message,
            state,
            file_id,
            photos,
            file_unique_id=file_entry.get("file_unique_id"),
        ):
            saved_any = True

    if not saved_any:
        return

    await update_photo_progress(
        message,
        state,
        len(photos),
        limit,
        force=progress_present,
    )
    if extra > 0:
        await message.answer(
            f"Уже загружено максимум фото ({len(photos)}/{limit}). Лишние не сохраняю."
        )


async def _album_timeout_handler(key: Tuple[int, str]) -> None:
    try:
        await asyncio.sleep(ALBUM_TIMEOUT)
    except asyncio.CancelledError:
        return
    entry = ALBUM_BUFFER.pop(key, None)
    if not entry:
        return
    await _process_album_entry(entry)


async def flush_user_albums(
    uid: Optional[int], state: FSMContext, process: bool = True
) -> None:
    if uid is None:
        return
    keys = [key for key in list(ALBUM_BUFFER.keys()) if key[0] == uid]
    for key in keys:
        entry = ALBUM_BUFFER.pop(key, None)
        if not entry:
            continue
        task: Optional[asyncio.Task] = entry.get("task")
        if task and not task.done():
            task.cancel()
        if not process:
            continue
        entry["state"] = state
        await _process_album_entry(entry)
async def append_current_infusion_and_prompt(msg_or_call, state: FSMContext):
    data = await state.get_data()
    inf = {
        "n": data.get("infusion_n", 1),
        "seconds": data.get("cur_seconds"),
        "liquor_color": data.get("cur_color"),
        "taste": data.get("cur_taste"),
        "special_notes": data.get("cur_special"),
        "body": data.get("cur_body"),
        "aftertaste": data.get("cur_aftertaste"),
    }
    infusions = data.get("infusions", [])
    infusions.append(inf)
    await state.update_data(
        infusions=infusions,
        infusion_n=inf["n"] + 1,
        cur_seconds=None,
        cur_color=None,
        cur_taste=None,
        cur_special=None,
        cur_body=None,
        cur_aftertaste=None,
        cur_taste_sel=[],
        cur_aftertaste_sel=[],
        awaiting_custom_taste=False,
        awaiting_custom_after=False,
    )

    kb = yesno_more_infusions_kb().as_markup()
    text = "Добавить ещё пролив или завершаем?"
    await ask_next(msg_or_call, state, text, kb)


async def finalize_save(target_message: Message, state: FSMContext):
    data = await state.get_data()
    await flush_user_albums(data.get("user_id"), state)
    data = await state.get_data()

    tasting_data = {
        "user_id": data.get("user_id"),
        "name": data.get("name"),
        "year": data.get("year"),
        "region": data.get("region"),
        "category": data.get("category"),
        "entry_mode": "full",
        "grams": data.get("grams"),
        "temp_c": data.get("temp_c"),
        "tasted_at": data.get("tasted_at"),
        "gear": data.get("gear"),
        "aroma_dry": data.get("aroma_dry"),
        "aroma_warmed": data.get("aroma_warmed"),
        "aroma_after": data.get("aroma_after"),
        "effects_csv": ",".join(data.get("effects", [])) or None,
        "scenarios_csv": ",".join(data.get("scenarios", [])) or None,
        "rating": data.get("rating", 0),
        "summary": data.get("summary") or None,
    }

    infusions_data = data.get("infusions", [])
    photo_entries: List[PhotoDraft] = (
        list(data.get("new_photos", []) or [])[:MAX_PHOTOS]
    )

    t = create_tasting(tasting_data, infusions_data, photo_entries)

    await state.clear()

    text_card = build_card_text(t, infusions_data, photo_count=len(photo_entries))
    photo_ids_to_send: List[str] = []
    for entry in photo_entries:
        if isinstance(entry, dict):
            telegram_file_id = entry.get("telegram_file_id")
            if telegram_file_id:
                photo_ids_to_send.append(telegram_file_id)
            continue

        if isinstance(entry, str) and entry:
            photo_ids_to_send.append(entry)
    await send_card_with_media(
        target_message,
        t.id,
        text_card,
        photo_ids_to_send,
        reply_markup=card_actions_kb(t.id).as_markup(),
    )


async def finalize_after_photos(target_message: Message, state: FSMContext):
    data = await state.get_data()
    if data.get("flow_kind") == "quick":
        await finalize_quick_save(target_message, state)
    else:
        await finalize_save(target_message, state)


async def finalize_quick_save(target_message: Message, state: FSMContext):
    data = await state.get_data()
    await flush_user_albums(data.get("user_id"), state)
    data = await state.get_data()

    tasting_data = {
        "user_id": data.get("user_id"),
        "name": data.get("name"),
        "year": None,
        "region": None,
        "category": data.get("category") or QUICK_CATEGORY_FALLBACK,
        "entry_mode": "quick",
        "grams": data.get("grams"),
        "temp_c": data.get("temp_c"),
        "tasted_at": None,
        "gear": data.get("gear"),
        "aroma_dry": data.get("aroma_dry"),
        "aroma_warmed": data.get("aroma_warmed"),
        "effects_csv": ",".join(data.get("effects", [])) or None,
        "scenarios_csv": None,
        "rating": data.get("rating"),
        "summary": data.get("summary"),
    }

    infusions_data: List[dict] = []
    photo_entries: List[PhotoDraft] = list(data.get("new_photos", []) or [])

    t = create_tasting(tasting_data, infusions_data, photo_entries)

    await state.clear()

    text_card = build_quick_card_text(t, photo_count=len(photo_entries))
    photo_ids_to_send: List[str] = []
    for entry in photo_entries:
        if isinstance(entry, dict):
            telegram_file_id = entry.get("telegram_file_id")
            if telegram_file_id:
                photo_ids_to_send.append(telegram_file_id)
            continue

        if isinstance(entry, str) and entry:
            photo_ids_to_send.append(entry)

    await send_card_with_media(
        target_message,
        t.id,
        text_card,
        photo_ids_to_send,
        reply_markup=quick_card_actions_kb(t.id).as_markup(),
    )


# ---------------- ФОТО ПОСЛЕ ЗАМЕТКИ ----------------

async def prompt_photos(target: Union[Message, CallbackQuery], state: FSMContext):
    base_message: Optional[Message]
    if isinstance(target, CallbackQuery):
        base_message = target.message
    elif isinstance(target, Message):
        base_message = target
    else:
        base_message = None

    if base_message is not None:
        await clear_live_question(target, base_message.chat.id, state=state)

    await flush_user_albums(
        getattr(target.from_user, "id", None) if hasattr(target, "from_user") else None,
        state,
        process=False,
    )

    prompt_text, prompt_markup = photo_prompt_content(MAX_PHOTOS)

    await state.update_data(
        new_photos=[],
        photo_count=0,
        photo_limit=MAX_PHOTOS,
    )

    if base_message is not None:
        await clear_photo_progress(base_message.bot, base_message.chat.id, state)
        sent = await base_message.answer(prompt_text, reply_markup=prompt_markup)
        await state.update_data(progress_msg_id=sent.message_id)
    await state.set_state(PhotoFlow.photos)


async def resend_photo_prompt(
    target: Union[Message, CallbackQuery], state: FSMContext
):
    base_message: Optional[Message]
    if isinstance(target, CallbackQuery):
        base_message = target.message
    elif isinstance(target, Message):
        base_message = target
    else:
        base_message = None

    data = await state.get_data()
    limit = int(data.get("photo_limit") or MAX_PHOTOS)
    photos: List[PhotoDraft] = list(data.get("new_photos", []) or [])

    if base_message is not None:
        if photos:
            await update_photo_progress(base_message, state, len(photos), limit)
        else:
            prompt_text, prompt_markup = photo_prompt_content(limit)
            sent = await base_message.answer(prompt_text, reply_markup=prompt_markup)
            await state.update_data(progress_msg_id=sent.message_id, photo_limit=limit)

    await state.set_state(PhotoFlow.photos)


async def photo_add(message: Message, state: FSMContext):
    data = await state.get_data()
    limit = data.get("photo_limit")
    if limit is None:
        return
    limit = int(limit)

    photos: List[PhotoDraft] = list(data.get("new_photos", []) or [])
    if len(photos) >= limit:
        await update_photo_progress(message, state, len(photos), limit)
        await message.answer(
            f"Уже загружено максимум фото ({len(photos)}/{limit}). Лишние не сохраняю."
        )
        return

    uid = data.get("user_id") or message.from_user.id
    media_group_id = message.media_group_id
    photo_obj = message.photo[-1]
    fid = photo_obj.file_id
    fuid = photo_obj.file_unique_id

    if media_group_id:
        key = (uid, media_group_id)
        entry = ALBUM_BUFFER.get(key)
        if not entry:
            entry = {"files": [], "message": message, "state": state, "task": None}
            ALBUM_BUFFER[key] = entry
        entry.setdefault("files", []).append(
            {"file_id": fid, "file_unique_id": fuid}
        )
        entry["message"] = message
        entry["state"] = state
        task: Optional[asyncio.Task] = entry.get("task")
        if task and not task.done():
            task.cancel()
        entry["task"] = asyncio.create_task(_album_timeout_handler(key))
        return

    if await _store_photo_from_file_id(
        message,
        state,
        fid,
        photos,
        file_unique_id=fuid,
    ):
        await update_photo_progress(message, state, len(photos), limit)


async def photos_done(call: CallbackQuery, state: FSMContext):
    current_state = await state.get_state()
    if current_state != PhotoFlow.photos.state:
        await call.answer("Сейчас нельзя завершить добавление фото.")
        return

    data = await state.get_data()
    photos: List[PhotoDraft] = list(data.get("new_photos", []) or [])
    if not photos:
        await call.answer(
            "Сначала добавь хотя бы одно фото или пропусти шаг.", show_alert=True
        )
        return

    if call.message:
        await clear_photo_progress(call.bot, call.message.chat.id, state)
    await finalize_after_photos(call.message, state)
    await call.answer()


async def photos_skip(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    photos_present = bool(data.get("new_photos"))
    if photos_present:
        await call.answer("Уже есть загруженные фото, нажми «Готово».", show_alert=True)
        return

    await flush_user_albums(call.from_user.id, state, process=False)
    await state.update_data(new_photos=[])
    if call.message:
        await clear_photo_progress(call.bot, call.message.chat.id, state)
    await finalize_after_photos(call.message, state)
    await call.answer()


async def show_pics(call: CallbackQuery):
    try:
        _, sid = call.data.split(":", 1)
        tid = int(sid)
    except Exception:
        await call.answer()
        return

    with SessionLocal() as s:
        t = s.get(Tasting, tid)
        if not t or t.user_id != call.from_user.id:
            await ui(call, "Фото не найдены.")
            await call.answer()
            return
        pics = [
            (p.telegram_file_id or p.file_id)
            for p in (t.photos or [])
            if (p.telegram_file_id or p.file_id)
        ]

    if not pics:
        await ui(call, "Фото нет.")
        await call.answer()
        return

    pics = pics[:MAX_PHOTOS]
    if len(pics) == 1:
        await call.message.answer_photo(pics[0])
    else:
        media = [InputMediaPhoto(media=fid) for fid in pics]
        await call.message.bot.send_media_group(call.message.chat.id, media)
    await call.answer()


# ---------------- СОЗДАНИЕ НОВОЙ ЗАПИСИ (опросник) ----------------

async def start_new(state: FSMContext, uid: int):
    await state.update_data(
        user_id=uid,
        infusions=[],
        effects=[],
        scenarios=[],
        infusion_n=1,
        aroma_dry_sel=[],
        aroma_warmed_sel=[],
        cur_taste_sel=[],
        cur_aftertaste_sel=[],
        new_photos=[],
        live_q_id=None,
        numpad_active=False,
        nt_step_msgs=[],
    )
    await state.set_state(NewTasting.name)


async def new_cmd(message: Message, state: FSMContext):
    uid = message.from_user.id
    await state.clear()
    await state.update_data(numpad_active=False)
    await flush_user_albums(uid, state, process=False)
    get_or_create_user(uid, message.from_user.username)
    await start_new(state, uid)
    await ask_name_prompt(message, state)


async def new_cb(call: CallbackQuery, state: FSMContext):
    uid = call.from_user.id
    await state.clear()
    await state.update_data(numpad_active=False)
    await flush_user_albums(uid, state, process=False)
    get_or_create_user(uid, call.from_user.username)
    await start_new(state, uid)
    await close_inline(call)
    await ask_name_prompt(call, state)
    await call.answer()


async def name_in(message: Message, state: FSMContext):
    title = (message.text or "").strip()
    await state.update_data(name=title)
    if title:
        await nt_ack(message, state, f"Название: {title}")
    await ask_year_prompt(message, state)


async def year_in(message: Message, state: FSMContext):
    if is_skip_input(message.text):
        await skip_year_value(message, state)
        return

    raw = (message.text or "").strip()
    try:
        value = parse_year_value(raw)
    except ValueError as exc:
        await message.answer(str(exc))
        await ask_year_prompt(message, state)
        return

    await state.update_data(year=value, numpad_active=False)
    await nt_ack(message, state, f"Год: {value}")
    await ask_region_prompt(message, state)


async def region_skip(call: CallbackQuery, state: FSMContext):
    await state.update_data(region=None)
    data = await state.get_data()
    if data.get("live_q_id"):
        await _nt_save_step(state, data["live_q_id"])
    await close_inline(call, "Регион: пропущено")
    await ask_category_prompt(call, state)
    await call.answer()


async def region_in(message: Message, state: FSMContext):
    region = message.text.strip()
    await state.update_data(region=region if region else None)
    if region:
        await nt_ack(message, state, f"Регион: {region}")
    await ask_category_prompt(message, state)


async def cat_pick(call: CallbackQuery, state: FSMContext):
    _, val = call.data.split(":", 1)
    if val == "Другое":
        await close_inline(call, "Категория: ввести текстом")
        await ask_next(call, state, "Введи категорию текстом:")
        await state.update_data(awaiting_custom_cat=True)
        await call.answer()
        return
    await state.update_data(category=val)
    data = await state.get_data()
    if data.get("live_q_id"):
        await _nt_save_step(state, data["live_q_id"])
    await close_inline(call, f"Категория: {val}")
    await ask_optional_grams_edit(call, state)


async def cat_custom_in(message: Message, state: FSMContext):
    data = await state.get_data()
    if not data.get("awaiting_custom_cat"):
        return
    category = (message.text or "").strip()
    await state.update_data(category=category, awaiting_custom_cat=False)
    if category:
        await ack(message, f"Категория: {category}")
    await ask_optional_grams_msg(message, state)


async def ask_optional_grams_edit(call: CallbackQuery, state: FSMContext):
    await ask_grams_prompt(call, state)
    await call.answer()


async def ask_optional_grams_msg(message: Message, state: FSMContext):
    await ask_grams_prompt(message, state)


async def grams_in(message: Message, state: FSMContext):
    if is_skip_input(message.text):
        await skip_grams_value(message, state)
        return

    raw = (message.text or "").strip()
    try:
        value = parse_grams_value(raw)
    except ValueError as exc:
        await message.answer(str(exc))
        await ask_grams_prompt(message, state)
        return

    await state.update_data(grams=value, numpad_active=False)
    await nt_ack(message, state, f"Граммовка: {value:g} г")
    await ask_temp_prompt(message, state)


async def temp_in(message: Message, state: FSMContext):
    if is_skip_input(message.text):
        await skip_temp_value(message, state)
        return

    raw = (message.text or "").strip()
    try:
        value = parse_temp_value(raw)
    except ValueError as exc:
        await message.answer(str(exc))
        await ask_temp_prompt(message, state)
        return

    await state.update_data(temp_c=value, numpad_active=False)
    await nt_ack(message, state, f"Температура: {value} °C")
    await ask_tasted_at_prompt(message, state, message.from_user.id)


async def time_now(call: CallbackQuery, state: FSMContext):
    now_hm = get_user_now_hm(call.from_user.id)
    await state.update_data(tasted_at=now_hm)
    data = await state.get_data()
    if data.get("live_q_id"):
        await _nt_save_step(state, data["live_q_id"])
    await close_inline(call, f"Время дегустации: {now_hm}")
    await ask_gear_prompt(call, state)
    await call.answer("Установлено текущее время")


async def tasted_at_skip(call: CallbackQuery, state: FSMContext):
    await state.update_data(tasted_at=None)
    data = await state.get_data()
    if data.get("live_q_id"):
        await _nt_save_step(state, data["live_q_id"])
    await close_inline(call, "Время дегустации: пропущено")
    await ask_gear_prompt(call, state)
    await call.answer("Пропущено")


async def tasted_at_in(message: Message, state: FSMContext):
    text_val = message.text.strip()
    ta = text_val[:5] if ":" in text_val else None
    await state.update_data(tasted_at=ta)
    if text_val:
        await nt_ack(message, state, f"Время дегустации: {text_val}")
    await ask_gear_prompt(message, state)


async def gear_skip(call: CallbackQuery, state: FSMContext):
    await state.update_data(gear=None)
    data = await state.get_data()
    if data.get("live_q_id"):
        await _nt_save_step(state, data["live_q_id"])
    await close_inline(call, "Посуда: пропущено")
    await ask_aroma_dry_call(call, state)
    await call.answer()


async def gear_in(message: Message, state: FSMContext):
    text_val = (message.text or "").strip()
    await state.update_data(gear=text_val)
    if text_val:
        await nt_ack(message, state, f"Посуда: {text_val}")
    await ask_aroma_dry_msg(message, state)


# --- ароматы

async def ask_aroma_dry_msg(message: Message, state: FSMContext):
    await state.update_data(aroma_dry_sel=[])
    await ask_next(
        message,
        state,
        "🌬️ [9/10] Аромат сухого листа: выбери дескрипторы и нажми «Готово», или «Другое».",
        aroma_dry_kb([]),
    )
    await state.set_state(NewTasting.aroma_dry)


async def ask_aroma_dry_call(call: CallbackQuery, state: FSMContext):
    await state.update_data(aroma_dry_sel=[])
    await ask_next(
        call,
        state,
        "🌬️ [9/10] Аромат сухого листа: выбери дескрипторы и нажми «Готово», или «Другое».",
        aroma_dry_kb([]),
    )
    await state.set_state(NewTasting.aroma_dry)


async def aroma_dry_toggle(call: CallbackQuery, state: FSMContext):
    _, tail = call.data.split(":", 1)
    data = await state.get_data()
    selected = data.get("aroma_dry_sel", [])
    if tail == "done":
        value = ", ".join(selected) if selected else None
        await state.update_data(
            aroma_dry=value,
            awaiting_custom_ad=False,
        )
        summary = value if value else "не выбрано"
        await close_inline(call, f"Аромат сухого листа: {summary}")
        data = await state.get_data()
        if data.get("live_q_id"):
            await _nt_save_step(state, data["live_q_id"])
        await ask_next(
            call,
            state,
            "🌬️ [10/10] Аромат прогретого/промытого листа: выбери и нажми «Готово».",
            aroma_warmed_kb([]),
        )
        await state.set_state(NewTasting.aroma_warmed)
        await call.answer()
        return
    if tail == "other":
        await state.update_data(awaiting_custom_ad=True)
        await close_inline(call, "Аромат сухого листа: ввести текстом")
        await ask_next(call, state, "Введи аромат сухого листа текстом:")
        await call.answer()
        return
    idx = int(tail)
    item = DESCRIPTORS[idx]
    if item in selected:
        selected.remove(item)
    else:
        selected.append(item)
    await state.update_data(aroma_dry_sel=selected)
    try:
        await call.message.edit_reply_markup(reply_markup=aroma_dry_kb(selected))
    except TelegramBadRequest:
        pass
    await call.answer()


async def aroma_dry_custom(message: Message, state: FSMContext):
    data = await state.get_data()
    if not data.get("awaiting_custom_ad"):
        return
    selected = data.get("aroma_dry_sel", [])
    txt = (message.text or "").strip()
    if txt:
        selected.append(txt)
    await state.update_data(
        aroma_dry=", ".join(selected) if selected else None,
        awaiting_custom_ad=False,
    )
    summary = ", ".join(selected) if selected else "не выбрано"
    await nt_ack(message, state, f"Аромат сухого листа: {summary}")
    await ask_next(
        message,
        state,
        "🌬️ [10/10] Аромат прогретого/промытого листа: выбери и нажми «Готово».",
        aroma_warmed_kb([]),
    )
    await state.set_state(NewTasting.aroma_warmed)


async def aroma_warmed_toggle(call: CallbackQuery, state: FSMContext):
    _, tail = call.data.split(":", 1)
    data = await state.get_data()
    selected = data.get("aroma_warmed_sel", [])
    if tail == "done":
        value = ", ".join(selected) if selected else None
        await state.update_data(
            aroma_warmed=value,
            awaiting_custom_aw=False,
        )
        summary = value if value else "не выбрано"
        await close_inline(call, f"Аромат прогретого листа: {summary}")
        data = await state.get_data()
        if data.get("live_q_id"):
            await _nt_save_step(state, data["live_q_id"])
        await start_infusion_block_call(call, state)
        return
    if tail == "other":
        await state.update_data(awaiting_custom_aw=True)
        await close_inline(call, "Аромат прогретого листа: ввести текстом")
        await ask_next(call, state, "Введи аромат прогретого/промытого листа текстом:")
        await call.answer()
        return
    idx = int(tail)
    item = DESCRIPTORS[idx]
    if item in selected:
        selected.remove(item)
    else:
        selected.append(item)
    await state.update_data(aroma_warmed_sel=selected)
    try:
        await call.message.edit_reply_markup(reply_markup=aroma_warmed_kb(selected))
    except TelegramBadRequest:
        pass
    await call.answer()


async def aroma_warmed_custom(message: Message, state: FSMContext):
    data = await state.get_data()
    if not data.get("awaiting_custom_aw"):
        return
    selected = data.get("aroma_warmed_sel", [])
    txt = (message.text or "").strip()
    if txt:
        selected.append(txt)
    value = ", ".join(selected) if selected else None
    await state.update_data(
        aroma_warmed=value,
        awaiting_custom_aw=False,
    )
    summary = value if value else "не выбрано"
    await nt_ack(message, state, f"Аромат прогретого листа: {summary}")
    await start_infusion_block_msg(message, state)


# --- проливы

async def prompt_infusion_seconds(
    target: Union[Message, CallbackQuery], state: FSMContext
) -> None:
    await state.update_data(numpad_active=False)
    data = await state.get_data()
    n = data.get("infusion_n", 1)
    await ask_next(target, state, f"🫖 Пролив {n}. Время, сек?", kb_inf_seconds())
    await state.set_state(InfusionState.seconds)


async def start_infusion_block_msg(message: Message, state: FSMContext):
    await prompt_infusion_seconds(message, state)


async def start_infusion_block_call(call: CallbackQuery, state: FSMContext):
    await prompt_infusion_seconds(call, state)
    await call.answer()


async def inf_seconds(message: Message, state: FSMContext):
    if is_skip_input(message.text):
        await state.update_data(cur_seconds=None, numpad_active=False)
        await ack(message, "Время пролива: пропущено")
        await proceed_to_infusion_color(message, state)
        return

    text = (message.text or "").strip()
    seconds_value: Optional[int] = None
    if text:
        match = re.search(r"-?\d+", text)
        if match:
            try:
                seconds_value = int(match.group())
            except ValueError:
                seconds_value = None
    await state.update_data(cur_seconds=seconds_value, numpad_active=False)
    status = (
        f"Время пролива: {seconds_value} сек" if seconds_value is not None else "Время пролива: пропущено"
    )
    await ack(message, status)
    await proceed_to_infusion_color(message, state)


async def inf_seconds_skip(call: CallbackQuery, state: FSMContext):
    await state.update_data(cur_seconds=None, numpad_active=False)
    await close_inline(call, "Время пролива: пропущено")
    await proceed_to_infusion_color(call, state)
    await call.answer("Пропущено")


async def proceed_to_infusion_color(
    target: Union[Message, CallbackQuery], state: FSMContext
) -> None:
    markup = skip_kb("color").as_markup()
    await ask_next(
        target,
        state,
        "Цвет настоя пролива? Можно пропустить.",
        markup,
    )
    await state.set_state(InfusionState.color)


async def color_skip(call: CallbackQuery, state: FSMContext):
    await state.update_data(cur_color=None)
    await state.update_data(cur_taste_sel=[])
    kb = toggle_list_kb(DESCRIPTORS, [], "taste", include_other=True)
    await close_inline(call, "Цвет пролива: пропущено")
    await ask_next(
        call,
        state,
        "Вкус настоя: выбери дескрипторы и нажми «Готово», или «Другое».",
        kb.as_markup(),
    )
    await state.set_state(InfusionState.taste)
    await call.answer()


async def inf_color(message: Message, state: FSMContext):
    text_val = (message.text or "").strip()
    await state.update_data(cur_color=text_val)
    await state.update_data(cur_taste_sel=[])
    kb = toggle_list_kb(DESCRIPTORS, [], "taste", include_other=True)
    if text_val:
        await ack(message, f"Цвет пролива: {text_val}")
    await ask_next(
        message,
        state,
        "Вкус настоя: выбери дескрипторы и нажми «Готово», или «Другое».",
        kb.as_markup(),
    )
    await state.set_state(InfusionState.taste)


async def taste_toggle(call: CallbackQuery, state: FSMContext):
    _, tail = call.data.split(":", 1)
    data = await state.get_data()
    selected = data.get("cur_taste_sel", [])
    if tail == "done":
        text_val = ", ".join(selected) if selected else None
        await state.update_data(cur_taste=text_val, awaiting_custom_taste=False)
        summary = text_val if text_val else "не выбрано"
        await close_inline(call, f"Вкус пролива: {summary}")
        await ask_next(
            call,
            state,
            "✨ Особенные ноты пролива? (можно пропустить)",
            skip_kb("special").as_markup(),
        )
        await state.set_state(InfusionState.special)
        await call.answer()
        return
    if tail == "other":
        await state.update_data(awaiting_custom_taste=True)
        await close_inline(call, "Вкус пролива: ввести текстом")
        await ask_next(call, state, "Введи вкус текстом:")
        await call.answer()
        return
    idx = int(tail)
    item = DESCRIPTORS[idx]
    if item in selected:
        selected.remove(item)
    else:
        selected.append(item)
    await state.update_data(cur_taste_sel=selected)
    kb = toggle_list_kb(DESCRIPTORS, selected, "taste", include_other=True)
    try:
        await call.message.edit_reply_markup(reply_markup=kb.as_markup())
    except TelegramBadRequest:
        pass
    await call.answer()


async def taste_custom(message: Message, state: FSMContext):
    data = await state.get_data()
    if not data.get("awaiting_custom_taste"):
        text_val = (message.text or "").strip() or None
        await state.update_data(cur_taste=text_val, awaiting_custom_taste=False)
        summary = text_val if text_val else "не указано"
        await ack(message, f"Вкус пролива: {summary}")
        await ask_next(
            message,
            state,
            "✨ Особенные ноты пролива? (можно пропустить)",
            skip_kb("special").as_markup(),
        )
        await state.set_state(InfusionState.special)
        return

    text_val = (message.text or "").strip() or None
    await state.update_data(
        cur_taste=text_val,
        awaiting_custom_taste=False,
    )
    summary = text_val if text_val else "не указано"
    await ack(message, f"Вкус пролива: {summary}")
    await ask_next(
        message,
        state,
        "✨ Особенные ноты пролива? (можно пропустить)",
        skip_kb("special").as_markup(),
    )
    await state.set_state(InfusionState.special)


async def inf_taste(message: Message, state: FSMContext):
    text_val = (message.text or "").strip() or None
    await state.update_data(
        cur_taste=text_val,
        awaiting_custom_taste=False,
    )
    summary = text_val if text_val else "не указано"
    await ack(message, f"Вкус пролива: {summary}")
    await ask_next(
        message,
        state,
        "✨ Особенные ноты пролива? (можно пропустить)",
        skip_kb("special").as_markup(),
    )
    await state.set_state(InfusionState.special)


async def special_skip(call: CallbackQuery, state: FSMContext):
    await state.update_data(cur_special=None)
    await close_inline(call, "Особенные ноты: пропущено")
    await ask_next(call, state, "Тело настоя?", body_kb().as_markup())
    await state.set_state(InfusionState.body)
    await call.answer()


async def inf_special(message: Message, state: FSMContext):
    text_val = (message.text or "").strip()
    await state.update_data(cur_special=text_val)
    if text_val:
        await ack(message, f"Особенные ноты: {text_val}")
    await ask_next(message, state, "Тело настоя?", body_kb().as_markup())
    await state.set_state(InfusionState.body)


async def inf_body_pick(call: CallbackQuery, state: FSMContext):
    _, val = call.data.split(":", 1)
    if val == "other":
        await close_inline(call, "Тело настоя: ввести текстом")
        await state.update_data(awaiting_custom_body=True)
        await state.set_state(InfusionState.body)
        await ask_next(call, state, "Введи тело настоя текстом:")
        await call.answer()
        return
    await state.update_data(cur_body=val)
    await state.update_data(cur_aftertaste_sel=[])
    kb = toggle_list_kb(AFTERTASTE_SET, [], "aft", include_other=True)
    await close_inline(call, f"Тело настоя: {val}")
    await ask_next(
        call,
        state,
        "Характер послевкусия: выбери пункты и нажми «Готово», или «Другое».",
        kb.as_markup(),
    )
    await state.set_state(InfusionState.aftertaste)
    await call.answer()


async def inf_body_custom(message: Message, state: FSMContext):
    data = await state.get_data()
    if not data.get("awaiting_custom_body"):
        return
    text_val = (message.text or "").strip()
    await state.update_data(
        cur_body=text_val, awaiting_custom_body=False
    )
    if text_val:
        await ack(message, f"Тело настоя: {text_val}")
    else:
        await ack(message, "Тело настоя: не указано")
    kb = toggle_list_kb(AFTERTASTE_SET, [], "aft", include_other=True)
    await ask_next(
        message,
        state,
        "Характер послевкусия: выбери пункты и нажми «Готово», или «Другое».",
        kb.as_markup(),
    )
    await state.set_state(InfusionState.aftertaste)


async def aftertaste_toggle(call: CallbackQuery, state: FSMContext):
    _, tail = call.data.split(":", 1)
    data = await state.get_data()
    selected = data.get("cur_aftertaste_sel", [])
    if tail == "done":
        await state.update_data(
            cur_aftertaste=", ".join(selected) if selected else None,
            awaiting_custom_after=False,
        )
        value = ", ".join(selected) if selected else None
        summary = value if value else "не выбрано"
        await close_inline(call, f"Послевкусие: {summary}")
        await append_current_infusion_and_prompt(call, state)
        await call.answer()
        return
    if tail == "other":
        await state.update_data(awaiting_custom_after=True)
        await close_inline(call, "Послевкусие: ввести текстом")
        await ask_next(call, state, "Введи характер послевкусия текстом:")
        await call.answer()
        return
    idx = int(tail)
    item = AFTERTASTE_SET[idx]
    if item in selected:
        selected.remove(item)
    else:
        selected.append(item)
    await state.update_data(cur_aftertaste_sel=selected)
    kb = toggle_list_kb(AFTERTASTE_SET, selected, "aft", include_other=True)
    try:
        await call.message.edit_reply_markup(reply_markup=kb.as_markup())
    except TelegramBadRequest:
        pass
    await call.answer()


async def aftertaste_custom(message: Message, state: FSMContext):
    """
    Обработка пользовательского текста после выбора 'Другое' в Характере послевкусия.
    Принимаем строку только если ранее было нажато 'Другое' (awaiting_custom_after=True).
    После сохранения сразу двигаем сценарий дальше.
    """
    data = await state.get_data()

    # Текст принимаем только после 'Другое'
    if not data.get("awaiting_custom_after"):
        await ui(
            message,
            "Выбери вариант из списка или нажми «Другое», чтобы ввести свой вариант."
        )
        return

    txt = (message.text or "").strip()
    if not txt:
        await ui(message, "Пусто. Введи характер послевкусия текстом или нажми «Сброс».")
        return

    # Сохраняем введённый текст и сбрасываем флаг ожидания кастомного ввода
    await state.update_data(cur_aftertaste=txt, awaiting_custom_after=False)
    summary = txt if txt else "не указано"
    await ack(message, f"Послевкусие: {summary}")

    # Переходим к следующему шагу (добавляем текущую инфузию и задаём следующий вопрос)
    await append_current_infusion_and_prompt(message, state)


async def more_infusions(call: CallbackQuery, state: FSMContext):
    await close_inline(call, "Добавляем пролив")
    await start_infusion_block_call(call, state)


async def ask_effects_prompt(target: Union[Message, CallbackQuery], state: FSMContext) -> None:
    data = await state.get_data()
    selected = data.get("effects", [])
    kb = toggle_list_kb(EFFECTS, selected, prefix="eff", include_other=True)
    await ask_next(
        target,
        state,
        "Ощущения (мультивыбор). Жми пункты, затем «Готово», либо «Другое».",
        kb.as_markup(),
    )
    await state.set_state(EffectsScenarios.effects)


async def finish_infusions(call: CallbackQuery, state: FSMContext):
    await close_inline(call, "Проливы: завершено")
    await ask_effects_prompt(call, state)
    await call.answer()


# --- ощущения / сценарии / оценка / заметка

async def eff_toggle_or_done(call: CallbackQuery, state: FSMContext):
    _, tail = call.data.split(":", 1)
    data = await state.get_data()
    selected = data.get("effects", [])
    if tail == "done":
        kb = toggle_list_kb(
            SCENARIOS,
            data.get("scenarios", []),
            prefix="scn",
            include_other=True,
        )
        summary = ", ".join(selected) if selected else "не выбрано"
        await close_inline(call, f"Ощущения: {summary}")
        await ask_next(
            call,
            state,
            "Сценарии (мультивыбор). Жми пункты, затем «Готово», либо «Другое».",
            kb.as_markup(),
        )
        await state.set_state(EffectsScenarios.scenarios)
        await call.answer()
        return
    if tail == "other":
        await state.update_data(awaiting_custom_eff=True)
        await close_inline(call, "Ощущения: ввести текстом")
        await ask_next(call, state, "Введи ощущение текстом:")
        await call.answer()
        return
    idx = int(tail)
    item = EFFECTS[idx]
    if item in selected:
        selected.remove(item)
    else:
        selected.append(item)
    await state.update_data(effects=selected)
    kb = toggle_list_kb(
        EFFECTS, selected, prefix="eff", include_other=True
    )
    try:
        await call.message.edit_reply_markup(reply_markup=kb.as_markup())
    except TelegramBadRequest:
        pass
    await call.answer()


async def eff_custom(message: Message, state: FSMContext):
    data = await state.get_data()
    if not data.get("awaiting_custom_eff"):
        return
    selected = data.get("effects", [])
    txt = message.text.strip()
    if txt:
        selected.append(txt)
    await state.update_data(effects=selected, awaiting_custom_eff=False)
    kb = toggle_list_kb(
        EFFECTS, selected, prefix="eff", include_other=True
    )
    if txt:
        await ack(message, f"Ощущения: добавлено {txt}")
    await ask_next(
        message,
        state,
        "Ощущения (мультивыбор). Жми пункты, затем «Готово», либо «Другое».",
        kb.as_markup(),
    )
    await state.set_state(EffectsScenarios.effects)


async def scn_toggle_or_done(call: CallbackQuery, state: FSMContext):
    _, tail = call.data.split(":", 1)
    data = await state.get_data()
    selected = data.get("scenarios", [])
    if tail == "done":
        summary = ", ".join(selected) if selected else "не выбрано"
        await close_inline(call, f"Сценарии: {summary}")
        await ask_next(call, state, "Оценка сорта 0..10?", rating_kb().as_markup())
        await state.set_state(RatingSummary.rating)
        await call.answer()
        return
    if tail == "other":
        await state.update_data(awaiting_custom_scn=True)
        await close_inline(call, "Сценарии: ввести текстом")
        await ask_next(call, state, "Введи сценарий текстом:")
        await call.answer()
        return
    idx = int(tail)
    item = SCENARIOS[idx]
    if item in selected:
        selected.remove(item)
    else:
        selected.append(item)
    await state.update_data(scenarios=selected)
    kb = toggle_list_kb(
        SCENARIOS, selected, prefix="scn", include_other=True
    )
    try:
        await call.message.edit_reply_markup(reply_markup=kb.as_markup())
    except TelegramBadRequest:
        pass
    await call.answer()


async def scn_custom(message: Message, state: FSMContext):
    data = await state.get_data()
    if not data.get("awaiting_custom_scn"):
        return
    selected = data.get("scenarios", [])
    txt = message.text.strip()
    if txt:
        selected.append(txt)
    await state.update_data(scenarios=selected, awaiting_custom_scn=False)
    kb = toggle_list_kb(
        SCENARIOS, selected, prefix="scn", include_other=True
    )
    if txt:
        await ack(message, f"Сценарий добавлен: {txt}")
    await ask_next(
        message,
        state,
        "Сценарии (мультивыбор). Жми пункты, затем «Готово», либо «Другое».",
        kb.as_markup(),
    )
    await state.set_state(EffectsScenarios.scenarios)


async def rate_pick(call: CallbackQuery, state: FSMContext):
    _, val = call.data.split(":", 1)
    await state.update_data(rating=int(val))
    await close_inline(call, f"Оценка: {val}/10")
    await ask_next(
        call,
        state,
        "📝 Заметка по дегустации? (можно пропустить)",
        skip_kb("summary").as_markup(),
    )
    await state.set_state(RatingSummary.summary)
    await call.answer()


async def rating_in(message: Message, state: FSMContext):
    txt = message.text.strip()
    rating = int(txt) if txt.isdigit() else 0
    rating = max(0, min(10, rating))
    await state.update_data(rating=rating)
    await ack(message, f"Оценка: {rating}/10")
    await ask_next(
        message,
        state,
        "📝 Заметка по дегустации? (можно пропустить)",
        skip_kb("summary").as_markup(),
    )
    await state.set_state(RatingSummary.summary)


async def summary_in(message: Message, state: FSMContext):
    text_val = (message.text or "").strip()
    await state.update_data(summary=text_val)
    if text_val:
        await ack(message, f"Заметка: {text_val}")
    await prompt_photos(message, state)


async def summary_skip(call: CallbackQuery, state: FSMContext):
    await state.update_data(summary=None)
    await close_inline(call, "Заметка: пропущено")
    await prompt_photos(call, state)
    await call.answer()


# ---------------- QUICK NOTE FLOW ----------------


def _parse_quick_effects_csv(raw: Optional[str]) -> list[str]:
    parts = [piece.strip() for piece in (raw or "").split(",")]
    return [p for p in parts if p]


def quick_edit_nav_kb(tid: int) -> InlineKeyboardBuilder:
    kb = InlineKeyboardBuilder()
    kb.button(text="⬅️ Назад", callback_data=f"qedit:back:{tid}")
    kb.button(text="⬅️ В меню", callback_data="back:main")
    kb.adjust(2)
    return kb


def qedit_type_kb(tid: int) -> InlineKeyboardBuilder:
    kb = InlineKeyboardBuilder()
    for code, label in QUICK_CATEGORIES.items():
        kb.button(text=label, callback_data=f"qedit:type:{code}")
    kb.button(text="Другое (ввести)", callback_data="qedit:type:other")
    kb.attach(quick_edit_nav_kb(tid))
    kb.adjust(2, 2, 2, 2)
    return kb


def qedit_temp_kb(tid: int) -> InlineKeyboardBuilder:
    kb = InlineKeyboardBuilder()
    for lo, hi in QUICK_TEMPS:
        kb.button(text=f"{lo}–{hi} °C", callback_data=f"qedit:temp:{hi}")
    kb.attach(quick_edit_nav_kb(tid))
    kb.adjust(2, 2, 1)
    return kb


def qedit_gear_kb(tid: int) -> InlineKeyboardBuilder:
    kb = InlineKeyboardBuilder()
    for code, label in QUICK_GEAR.items():
        kb.button(text=label, callback_data=f"qedit:gear:{code}")
    kb.button(text="Другое (ввести)", callback_data="qedit:gear:other")
    kb.attach(quick_edit_nav_kb(tid))
    kb.adjust(2, 2, 1)
    return kb


def qedit_effects_kb(selected: list[str], tid: int) -> InlineKeyboardBuilder:
    kb = InlineKeyboardBuilder()
    selected_set = {item.strip() for item in selected}
    for code, label in QUICK_EFFECTS.items():
        prefix = "✅ " if label in selected_set else ""
        kb.button(text=f"{prefix}{label}", callback_data=f"qedit:eff:{code}")
    kb.button(text="Другое (ввести)", callback_data="qedit:eff:other")
    kb.button(text="ГОТОВО", callback_data="qedit:eff:done")
    kb.attach(quick_edit_nav_kb(tid))
    kb.adjust(2, 2, 2, 1, 1, 2, 2)
    return kb


def qedit_rating_kb(tid: int) -> InlineKeyboardBuilder:
    kb = InlineKeyboardBuilder()
    for val in range(0, 11):
        kb.button(text=str(val), callback_data=f"qedit:rate:{val}")
    kb.attach(quick_edit_nav_kb(tid))
    kb.adjust(6, 5, 2)
    return kb


async def start_quick_flow(
    target: Union[Message, CallbackQuery], state: FSMContext, uid: int, username: Optional[str]
):
    await state.clear()
    await flush_user_albums(uid, state, process=False)
    get_or_create_user(uid, username)
    await state.update_data(
        flow_kind="quick",
        user_id=uid,
        name=None,
        category=None,
        grams=None,
        temp_c=None,
        gear=None,
        aroma_dry=None,
        aroma_warmed=None,
        effects=[],
        rating=None,
        summary=None,
        new_photos=[],
        live_q_id=None,
        quick_step_msgs=[],
    )
    await ask_quick_name(target, state)


def _extract_target_bot_chat(
    target: Union[Message, CallbackQuery]
) -> tuple[Bot, int]:
    if isinstance(target, CallbackQuery):
        bot = target.message.bot if target.message else target.bot
        chat_id = target.message.chat.id if target.message else target.from_user.id
    else:
        bot = target.bot
        chat_id = target.chat.id
    return bot, chat_id


def _quick_state_to_step(state_name: Optional[str]) -> Optional[str]:
    mapping = {
        QuickNote.name.state: "name",
        QuickNote.type_pick.state: "type",
        QuickNote.type_custom.state: "type",
        QuickNote.grams.state: "grams",
        QuickNote.temp_pick.state: "temp",
        QuickNote.gear_pick.state: "gear",
        QuickNote.gear_custom.state: "gear",
        QuickNote.aroma.state: "aroma",
        QuickNote.taste.state: "taste",
        QuickNote.eff_pick.state: "eff",
        QuickNote.eff_custom.state: "eff",
        QuickNote.rating.state: "rating",
        QuickNote.note.state: "note",
        PhotoFlow.photos.state: "photos",
    }
    return mapping.get(state_name or "")


def _quick_prev_step(step_id: Optional[str]) -> Optional[str]:
    order = [
        "name",
        "type",
        "grams",
        "temp",
        "gear",
        "aroma",
        "taste",
        "eff",
        "rating",
        "note",
        "photos",
    ]
    if not step_id or step_id not in order:
        return None
    idx = order.index(step_id)
    return order[idx - 1] if idx > 0 else None


async def _quick_register_step_message(state: FSMContext, step_id: str, msg_id: int):
    data = await state.get_data()
    msgs: list[dict] = list(data.get("quick_step_msgs") or [])
    for idx, entry in enumerate(msgs):
        if entry.get("step_id") == step_id:
            msgs[idx] = {"step_id": step_id, "msg_id": msg_id}
            break
    else:
        msgs.append({"step_id": step_id, "msg_id": msg_id})
    await state.update_data(quick_step_msgs=msgs)


async def _quick_get_step_message_id(state: FSMContext, step_id: str) -> Optional[int]:
    data = await state.get_data()
    msgs: list[dict] = list(data.get("quick_step_msgs") or [])
    for entry in msgs:
        if entry.get("step_id") == step_id:
            return entry.get("msg_id")
    return None


async def _quick_cleanup_from_step(
    target: Union[Message, CallbackQuery], state: FSMContext, target_step: str
):
    bot, chat_id = _extract_target_bot_chat(target)
    data = await state.get_data()
    msgs: list[dict] = list(data.get("quick_step_msgs") or [])
    trimmed: list[dict] = []
    deleting = False
    for entry in msgs:
        step_id = entry.get("step_id")
        msg_id = entry.get("msg_id")
        if step_id == target_step:
            deleting = True
        if deleting:
            with suppress(Exception):
                await bot.delete_message(chat_id, msg_id)
        else:
            trimmed.append(entry)
    await state.update_data(quick_step_msgs=trimmed)


async def _quick_send_step_question(
    target: Union[Message, CallbackQuery],
    state: FSMContext,
    step_id: str,
    text: str,
    kb,
):
    bot, chat_id = _extract_target_bot_chat(target)
    safe_text = _safe_text(text)
    msg_id = await _quick_get_step_message_id(state, step_id)
    sent: Optional[Message] = None
    if msg_id:
        try:
            sent = await bot.edit_message_text(
                chat_id=chat_id,
                message_id=msg_id,
                text=safe_text,
                reply_markup=kb,
            )
        except TelegramBadRequest:
            pass
    if sent is None:
        base = target.message if isinstance(target, CallbackQuery) else target
        sent = await base.answer(safe_text, reply_markup=kb)
    await _quick_register_step_message(state, step_id, sent.message_id)
    return sent


async def _quick_mark_answer(
    target: Union[Message, CallbackQuery], state: FSMContext, step_id: str, text: str
):
    bot, chat_id = _extract_target_bot_chat(target)
    safe_text = _safe_text(f"✅ {text}")
    msg_id = await _quick_get_step_message_id(state, step_id)
    if msg_id:
        try:
            await bot.edit_message_text(
                chat_id=chat_id,
                message_id=msg_id,
                text=safe_text,
                reply_markup=None,
            )
            return
        except TelegramBadRequest:
            pass
    base = target.message if isinstance(target, CallbackQuery) else target
    await base.answer(safe_text)


async def ask_quick_question(
    target: Union[Message, CallbackQuery],
    state: FSMContext,
    text: str,
    kb,
    *,
    step_id: str,
):
    return await _quick_send_step_question(target, state, step_id, text, kb)


async def prompt_cancel_confirmation(
    target: Union[Message, CallbackQuery], state: FSMContext, *, use_live_question: bool
):
    markup = q_cancel_confirm_kb().as_markup()
    if use_live_question:
        await ask_quick_question(
            target, state, CANCEL_CONFIRM_TEXT, markup, step_id="cancel"
        )
    else:
        await ui(target, CANCEL_CONFIRM_TEXT, reply_markup=markup)


async def nt_back(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    live_q_id = data.get("live_q_id")
    if live_q_id:
        with suppress(Exception):
            await call.message.bot.delete_message(call.message.chat.id, live_q_id)
    msgs = list(data.get("nt_step_msgs", []) or [])
    if msgs:
        last_msg_id = msgs.pop()
        with suppress(Exception):
            await call.message.bot.delete_message(call.message.chat.id, last_msg_id)
    await state.update_data(live_q_id=None, nt_step_msgs=msgs)
    current_state = await state.get_state()
    if current_state == NewTasting.year.state:
        await state.update_data(year=None)
        await ask_name_prompt(call, state)
    elif current_state == NewTasting.region.state:
        await state.update_data(region=None)
        await ask_year_prompt(call, state)
    elif current_state == NewTasting.category.state:
        await state.update_data(category=None, awaiting_custom_cat=False)
        await ask_region_prompt(call, state)
    elif current_state == NewTasting.grams.state:
        await state.update_data(grams=None)
        await ask_category_prompt(call, state)
    elif current_state == NewTasting.temp_c.state:
        await state.update_data(temp_c=None)
        await ask_grams_prompt(call, state)
    elif current_state == NewTasting.tasted_at.state:
        await state.update_data(tasted_at=None)
        await ask_temp_prompt(call, state)
    elif current_state == NewTasting.gear.state:
        await state.update_data(gear=None)
        await ask_tasted_at_prompt(call, state, call.from_user.id)
    elif current_state == NewTasting.aroma_dry.state:
        await state.update_data(aroma_dry=None, aroma_dry_sel=[])
        await ask_gear_prompt(call, state)
    elif current_state == NewTasting.aroma_warmed.state:
        await state.update_data(aroma_warmed=None, aroma_warmed_sel=[])
        await ask_aroma_dry_call(call, state)
    await call.answer()


async def resend_new_prompt(target: Union[Message, CallbackQuery], state: FSMContext) -> bool:
    data = await state.get_data()
    target_state = data.get("cancel_return_state") or await state.get_state()
    if not target_state:
        return False

    prompt_map: dict[str, Callable[[], Awaitable[None]]] = {
        NewTasting.name.state: lambda: ask_name_prompt(target, state),
        NewTasting.year.state: lambda: ask_year_prompt(target, state),
        NewTasting.region.state: lambda: ask_region_prompt(target, state),
        NewTasting.category.state: lambda: ask_category_prompt(target, state),
        NewTasting.grams.state: lambda: ask_grams_prompt(target, state),
        NewTasting.temp_c.state: lambda: ask_temp_prompt(target, state),
        NewTasting.tasted_at.state: lambda: ask_tasted_at_prompt(
            target, state, target.from_user.id  # type: ignore[arg-type]
        ),
        NewTasting.gear.state: lambda: ask_gear_prompt(target, state),
        NewTasting.aroma_dry.state: lambda: (
            ask_aroma_dry_call(target, state)
            if isinstance(target, CallbackQuery)
            else ask_aroma_dry_msg(target, state)
        ),
        NewTasting.aroma_warmed.state: lambda: ask_next(
            target,
            state,
            "🌬️ [10/10] Аромат прогретого/промытого листа: выбери и нажми «Готово».",
            aroma_warmed_kb([]),
        ),
        InfusionState.seconds.state: lambda: prompt_infusion_seconds(target, state),
        InfusionState.color.state: lambda: proceed_to_infusion_color(target, state),
        InfusionState.taste.state: lambda: ask_next(
            target,
            state,
            "Вкус настоя: выбери дескрипторы и нажми «Готово», или «Другое».",
            toggle_list_kb(
                DESCRIPTORS,
                (data.get("cur_taste_sel") or []),
                "taste",
                include_other=True,
            ).as_markup(),
        ),
        InfusionState.special.state: lambda: ask_next(
            target,
            state,
            "✨ Особенные ноты пролива? (можно пропустить)",
            skip_kb("special").as_markup(),
        ),
        InfusionState.body.state: lambda: ask_next(
            target, state, "Тело настоя?", body_kb().as_markup()
        ),
        InfusionState.aftertaste.state: lambda: ask_next(
            target,
            state,
            "Характер послевкусия: выбери пункты и нажми «Готово», или «Другое».",
            toggle_list_kb(
                AFTERTASTE_SET,
                (data.get("cur_aftertaste_sel") or []),
                "aft",
                include_other=True,
            ).as_markup(),
        ),
        EffectsScenarios.effects.state: lambda: ask_effects_prompt(target, state),
        EffectsScenarios.scenarios.state: lambda: ask_next(
            target,
            state,
            "Сценарии (мультивыбор). Жми пункты, затем «Готово», либо «Другое».",
            toggle_list_kb(
                SCENARIOS,
                (data.get("scenarios") or []),
                prefix="scn",
                include_other=True,
            ).as_markup(),
        ),
        RatingSummary.rating.state: lambda: ask_next(
            target, state, "Оценка сорта 0..10?", rating_kb().as_markup()
        ),
        RatingSummary.summary.state: lambda: ask_next(
            target,
            state,
            "📝 Заметка по дегустации? (можно пропустить)",
            skip_kb("summary").as_markup(),
        ),
        PhotoFlow.photos.state: lambda: resend_photo_prompt(target, state),
    }

    prompt = prompt_map.get(target_state)
    if not prompt:
        return False

    await state.set_state(target_state)
    await prompt()
    return True


async def ask_quick_name(target: Union[Message, CallbackQuery], state: FSMContext):
    await state.set_state(QuickNote.name)
    await ask_quick_question(
        target,
        state,
        "Название чая?",
        q_cancel_only_kb().as_markup(),
        step_id="name",
    )


async def ask_quick_type(target: Union[Message, CallbackQuery], state: FSMContext):
    await state.set_state(QuickNote.type_pick)
    await ask_quick_question(
        target, state, "Тип чая?", q_type_kb().as_markup(), step_id="type"
    )


async def ask_quick_type_custom(target: Union[Message, CallbackQuery], state: FSMContext):
    await state.set_state(QuickNote.type_custom)
    await ask_quick_question(
        target,
        state,
        "Напиши тип чая текстом",
        q_nav_kb(can_back=True, can_skip=False, skip_step=None).as_markup(),
        step_id="type",
    )


async def ask_quick_grams(target: Union[Message, CallbackQuery], state: FSMContext):
    await state.set_state(QuickNote.grams)
    await ask_quick_question(
        target,
        state,
        "Граммовка? Можно пропустить.",
        q_nav_kb(can_back=True, can_skip=True, skip_step="grams").as_markup(),
        step_id="grams",
    )


async def ask_quick_temp(target: Union[Message, CallbackQuery], state: FSMContext):
    await state.set_state(QuickNote.temp_pick)
    await ask_quick_question(
        target, state, "Температура воды?", q_temp_kb().as_markup(), step_id="temp"
    )


async def ask_quick_gear(target: Union[Message, CallbackQuery], state: FSMContext):
    await state.set_state(QuickNote.gear_pick)
    await ask_quick_question(
        target,
        state,
        "Посудa дегустации?",
        q_gear_kb().as_markup(),
        step_id="gear",
    )


async def ask_quick_gear_custom(target: Union[Message, CallbackQuery], state: FSMContext):
    await state.set_state(QuickNote.gear_custom)
    await ask_quick_question(
        target,
        state,
        "Напиши посуду текстом",
        q_nav_kb(can_back=True, can_skip=False, skip_step=None).as_markup(),
        step_id="gear",
    )


async def ask_quick_aroma(target: Union[Message, CallbackQuery], state: FSMContext):
    await state.set_state(QuickNote.aroma)
    await ask_quick_question(
        target,
        state,
        "Аромат? Можно пропустить.",
        q_nav_kb(can_back=True, can_skip=True, skip_step="aroma").as_markup(),
        step_id="aroma",
    )


async def ask_quick_taste(target: Union[Message, CallbackQuery], state: FSMContext):
    await state.set_state(QuickNote.taste)
    await ask_quick_question(
        target,
        state,
        "Вкус? Можно пропустить.",
        q_nav_kb(can_back=True, can_skip=True, skip_step="taste").as_markup(),
        step_id="taste",
    )


async def ask_quick_effects(target: Union[Message, CallbackQuery], state: FSMContext):
    data = await state.get_data()
    selected = list(data.get("effects", []) or [])
    await state.set_state(QuickNote.eff_pick)
    await ask_quick_question(
        target,
        state,
        "Ощущения? Жми варианты, затем «ГОТОВО», можно пропустить.",
        q_effects_kb(selected).as_markup(),
        step_id="eff",
    )


async def ask_quick_rating(target: Union[Message, CallbackQuery], state: FSMContext):
    await state.set_state(QuickNote.rating)
    await ask_quick_question(
        target, state, "Оценка 0..10?", q_rating_kb().as_markup(), step_id="rating"
    )


async def ask_quick_note(target: Union[Message, CallbackQuery], state: FSMContext):
    await state.set_state(QuickNote.note)
    await ask_quick_question(
        target,
        state,
        "Заметка? Можно пропустить.",
        q_nav_kb(can_back=True, can_skip=True, skip_step="note").as_markup(),
        step_id="note",
    )


async def ask_quick_effect_custom(
    target: Union[Message, CallbackQuery], state: FSMContext
):
    await state.set_state(QuickNote.eff_custom)
    await ask_quick_question(
        target,
        state,
        "Напиши своё ощущение",
        q_nav_kb(can_back=True, can_skip=False, skip_step=None).as_markup(),
        step_id="eff",
    )


async def quick_new_cmd(message: Message, state: FSMContext):
    uid = message.from_user.id
    await start_quick_flow(message, state, uid, message.from_user.username)


async def quick_new_cb(call: CallbackQuery, state: FSMContext):
    uid = call.from_user.id
    await start_quick_flow(call, state, uid, call.from_user.username)
    await call.answer()


async def quick_name_in(message: Message, state: FSMContext):
    title = (message.text or "").strip()
    if not title:
        await message.answer("Название нужно указать")
        await ask_quick_name(message, state)
        return

    await state.update_data(name=title)
    await _quick_mark_answer(message, state, "name", f"Название: {title}")
    await ask_quick_type(message, state)


async def quick_type_pick(call: CallbackQuery, state: FSMContext):
    _, _, tail = call.data.partition(":")
    _, _, code = tail.partition(":")

    if code == "other":
        await ask_quick_type_custom(call, state)
        await call.answer()
        return

    value = QUICK_CATEGORIES.get(code)
    await state.update_data(category=value)
    await _quick_mark_answer(call, state, "type", f"Тип: {value or 'не указан'}")
    await ask_quick_grams(call, state)
    await call.answer()


async def quick_type_custom_in(message: Message, state: FSMContext):
    text_val = (message.text or "").strip()
    if not text_val:
        await message.answer("Укажи тип текста или нажми «Назад».")
        await ask_quick_type_custom(message, state)
        return
    await state.update_data(category=text_val)
    await _quick_mark_answer(message, state, "type", f"Тип: {text_val}")
    await ask_quick_grams(message, state)


async def quick_grams_in(message: Message, state: FSMContext):
    raw = (message.text or "").strip()
    try:
        val = parse_grams_value(raw)
    except ValueError as exc:
        await message.answer(str(exc))
        await ask_quick_grams(message, state)
        return
    await state.update_data(grams=val)
    await _quick_mark_answer(message, state, "grams", f"Граммовка: {val} г")
    await ask_quick_temp(message, state)


async def quick_temp_pick(call: CallbackQuery, state: FSMContext):
    _, _, tail = call.data.partition(":")
    _, _, raw_val = tail.partition(":")
    try:
        temp_val = int(raw_val)
    except ValueError:
        await call.answer()
        return

    await state.update_data(temp_c=temp_val)
    await _quick_mark_answer(call, state, "temp", f"Температура: {temp_val}°C")
    await ask_quick_gear(call, state)
    await call.answer()


async def quick_gear_pick(call: CallbackQuery, state: FSMContext):
    _, _, tail = call.data.partition(":")
    _, _, code = tail.partition(":")

    if code == "other":
        await ask_quick_gear_custom(call, state)
        await call.answer()
        return

    value = QUICK_GEAR.get(code)
    await state.update_data(gear=value)
    await _quick_mark_answer(call, state, "gear", f"Посуда: {value or 'не указана'}")
    await ask_quick_aroma(call, state)
    await call.answer()


async def quick_gear_custom_in(message: Message, state: FSMContext):
    text_val = (message.text or "").strip()
    if not text_val:
        await message.answer("Введи посуду текстом или нажми «Назад».")
        await ask_quick_gear_custom(message, state)
        return
    await state.update_data(gear=text_val)
    await _quick_mark_answer(message, state, "gear", f"Посуда: {text_val}")
    await ask_quick_aroma(message, state)


async def quick_aroma_in(message: Message, state: FSMContext):
    text_val = (message.text or "").strip()
    if not text_val:
        await message.answer("Можешь описать аромат или нажать «Пропустить».")
        await ask_quick_aroma(message, state)
        return
    await state.update_data(aroma_dry=text_val)
    await _quick_mark_answer(message, state, "aroma", f"Аромат: {text_val}")
    await ask_quick_taste(message, state)


async def quick_taste_in(message: Message, state: FSMContext):
    text_val = (message.text or "").strip()
    if not text_val:
        await message.answer("Можешь описать вкус или нажать «Пропустить».")
        await ask_quick_taste(message, state)
        return
    await state.update_data(aroma_warmed=text_val)
    await _quick_mark_answer(message, state, "taste", f"Вкус: {text_val}")
    await ask_quick_effects(message, state)


async def quick_eff_toggle(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    selected: list[str] = list(data.get("effects", []) or [])
    _, _, tail = call.data.partition(":")
    _, _, code = tail.partition(":")

    if code == "done":
        summary = ", ".join(selected) if selected else "не выбраны"
        await _quick_mark_answer(call, state, "eff", f"Ощущения: {summary}")
        await ask_quick_rating(call, state)
        await call.answer()
        return
    if code == "other":
        await ask_quick_effect_custom(call, state)
        await call.answer()
        return

    label = QUICK_EFFECTS.get(code)
    if not label:
        await call.answer()
        return
    if label in selected:
        selected.remove(label)
    else:
        selected.append(label)

    await state.update_data(effects=selected)
    kb = q_effects_kb(selected)
    try:
        await call.message.edit_reply_markup(reply_markup=kb.as_markup())
    except TelegramBadRequest:
        pass
    await call.answer()


async def quick_eff_custom_in(message: Message, state: FSMContext):
    text_val = (message.text or "").strip()
    if not text_val:
        await message.answer("Введи ощущение текстом или нажми «Назад».")
        await ask_quick_effect_custom(message, state)
        return
    data = await state.get_data()
    selected: list[str] = list(data.get("effects", []) or [])
    selected.append(text_val)
    await state.update_data(effects=selected)
    await _quick_mark_answer(
        message, state, "eff", f"Ощущения: {', '.join(selected) or 'добавлено'}"
    )
    await ask_quick_rating(message, state)


async def quick_rating_pick(call: CallbackQuery, state: FSMContext):
    _, _, tail = call.data.partition(":")
    _, _, raw_val = tail.partition(":")
    try:
        val = int(raw_val)
    except ValueError:
        await call.answer()
        return
    val = max(0, min(10, val))
    await state.update_data(rating=val)
    await _quick_mark_answer(call, state, "rating", f"Оценка: {val}/10")
    await ask_quick_note(call, state)
    await call.answer()


async def quick_note_in(message: Message, state: FSMContext):
    text_val = (message.text or "").strip()
    await state.update_data(summary=text_val if text_val else None)
    await _quick_mark_answer(
        message,
        state,
        "note",
        f"Заметка: {text_val if text_val else 'пропущено'}",
    )
    await prompt_photos(message, state)


async def quick_skip(call: CallbackQuery, state: FSMContext):
    _, _, tail = call.data.partition(":")
    _, _, step = tail.partition(":")
    if step == "type":
        await state.update_data(category=QUICK_CATEGORY_FALLBACK)
        await _quick_mark_answer(call, state, "type", "Тип: не знаю")
        await ask_quick_grams(call, state)
    elif step == "grams":
        await state.update_data(grams=None)
        await _quick_mark_answer(call, state, "grams", "Граммовка: пропущено")
        await ask_quick_temp(call, state)
    elif step == "temp":
        await state.update_data(temp_c=None)
        await _quick_mark_answer(call, state, "temp", "Температура: пропущено")
        await ask_quick_gear(call, state)
    elif step == "gear":
        await state.update_data(gear=None)
        await _quick_mark_answer(call, state, "gear", "Посуда: пропущено")
        await ask_quick_aroma(call, state)
    elif step == "aroma":
        await state.update_data(aroma_dry=None)
        await _quick_mark_answer(call, state, "aroma", "Аромат: пропущено")
        await ask_quick_taste(call, state)
    elif step == "taste":
        await state.update_data(aroma_warmed=None)
        await _quick_mark_answer(call, state, "taste", "Вкус: пропущено")
        await ask_quick_effects(call, state)
    elif step == "eff":
        await state.update_data(effects=[])
        await _quick_mark_answer(call, state, "eff", "Ощущения: пропущено")
        await ask_quick_rating(call, state)
    elif step == "note":
        await state.update_data(summary=None)
        await _quick_mark_answer(call, state, "note", "Заметка: пропущено")
        await prompt_photos(call, state)
    await call.answer("Пропущено")


async def quick_back(call: CallbackQuery, state: FSMContext):
    current_state = await state.get_state()
    current_step = _quick_state_to_step(current_state)
    custom_back_targets = {
        QuickNote.type_custom.state: "type",
        QuickNote.gear_custom.state: "gear",
        QuickNote.eff_custom.state: "eff",
    }
    target_step = custom_back_targets.get(current_state)
    if not target_step:
        target_step = _quick_prev_step(current_step)
    if not target_step:
        await call.answer()
        return

    await _quick_cleanup_from_step(call, state, target_step)

    step_order = [
        "name",
        "type",
        "grams",
        "temp",
        "gear",
        "aroma",
        "taste",
        "eff",
        "rating",
        "note",
    ]
    step_fields = {
        "name": ["name"],
        "type": ["category"],
        "grams": ["grams"],
        "temp": ["temp_c"],
        "gear": ["gear"],
        "aroma": ["aroma_dry"],
        "taste": ["aroma_warmed"],
        "eff": ["effects"],
        "rating": ["rating"],
        "note": ["summary"],
    }
    if target_step in step_order:
        idx = step_order.index(target_step)
        reset_fields: dict[str, Any] = {}
        for step in step_order[idx:]:
            for field in step_fields.get(step, []):
                reset_fields[field] = [] if field == "effects" else None
        if reset_fields:
            await state.update_data(**reset_fields)

    step_states = {
        "name": QuickNote.name,
        "type": QuickNote.type_pick,
        "grams": QuickNote.grams,
        "temp": QuickNote.temp_pick,
        "gear": QuickNote.gear_pick,
        "aroma": QuickNote.aroma,
        "taste": QuickNote.taste,
        "eff": QuickNote.eff_pick,
        "rating": QuickNote.rating,
        "note": QuickNote.note,
    }
    ask_map = {
        "name": ask_quick_name,
        "type": ask_quick_type,
        "grams": ask_quick_grams,
        "temp": ask_quick_temp,
        "gear": ask_quick_gear,
        "aroma": ask_quick_aroma,
        "taste": ask_quick_taste,
        "eff": ask_quick_effects,
        "rating": ask_quick_rating,
        "note": ask_quick_note,
    }

    target_state = step_states.get(target_step)
    ask_fn = ask_map.get(target_step)
    if target_state and ask_fn:
        await state.set_state(target_state)
        await ask_fn(call, state)
    await call.answer()


async def quick_cancel(call: CallbackQuery, state: FSMContext):
    current_state = await state.get_state()
    if not current_state:
        await call.answer()
        return
    await state.update_data(cancel_return_state=current_state)
    await state.set_state(QuickCancel.confirm)
    await prompt_cancel_confirmation(call, state, use_live_question=False)
    await call.answer()


async def quick_cancel_yes(call: CallbackQuery, state: FSMContext):
    await call.answer()
    data = await state.get_data()
    with suppress(TelegramBadRequest):
        if call.message:
            await call.message.edit_reply_markup(reply_markup=None)
    await clear_live_question(call, call.from_user.id, state=state)
    await flush_user_albums(data.get("user_id") or call.from_user.id, state, process=False)
    await state.clear()
    await state.update_data(numpad_active=False)
    bot = call.message.bot if call.message else call.bot
    await show_main_menu(bot, call.from_user.id)


async def _quick_cancel_resume(call: CallbackQuery, state: FSMContext, return_state: str):
    target_step = _quick_state_to_step(return_state)
    if target_step:
        await _quick_cleanup_from_step(call, state, target_step)
    await state.set_state(return_state)
    if return_state == QuickNote.name.state:
        await ask_quick_name(call, state)
    elif return_state == QuickNote.type_pick.state:
        await ask_quick_type(call, state)
    elif return_state == QuickNote.type_custom.state:
        await ask_quick_type_custom(call, state)
    elif return_state == QuickNote.grams.state:
        await ask_quick_grams(call, state)
    elif return_state == QuickNote.temp_pick.state:
        await ask_quick_temp(call, state)
    elif return_state == QuickNote.gear_pick.state:
        await ask_quick_gear(call, state)
    elif return_state == QuickNote.gear_custom.state:
        await ask_quick_gear_custom(call, state)
    elif return_state == QuickNote.aroma.state:
        await ask_quick_aroma(call, state)
    elif return_state == QuickNote.taste.state:
        await ask_quick_taste(call, state)
    elif return_state == QuickNote.eff_pick.state:
        await ask_quick_effects(call, state)
    elif return_state == QuickNote.eff_custom.state:
        await ask_quick_effect_custom(call, state)
    elif return_state == QuickNote.rating.state:
        await ask_quick_rating(call, state)
    elif return_state == QuickNote.note.state:
        await ask_quick_note(call, state)


async def quick_cancel_no(call: CallbackQuery, state: FSMContext):
    await call.answer()
    with suppress(TelegramBadRequest):
        if call.message:
            await call.message.edit_reply_markup(reply_markup=None)
    data = await state.get_data()
    return_state = data.get("cancel_return_state")
    if not return_state:
        bot = call.message.bot if call.message else call.bot
        await show_main_menu(bot, call.from_user.id)
        return

    if data.get("flow_kind") == "quick":
        await _quick_cancel_resume(call, state, return_state)
        return

    resumed = await resend_new_prompt(call, state)
    if not resumed:
        bot = call.message.bot if call.message else call.bot
        await show_main_menu(bot, call.from_user.id)


async def quick_cancel_router(call: CallbackQuery, state: FSMContext):
    if call.data == "q:cancel:yes":
        await quick_cancel_yes(call, state)
    elif call.data == "q:cancel:no":
        await quick_cancel_no(call, state)


async def get_quick_card_payload(tid: int, uid: Optional[int] = None):
    with SessionLocal() as s:
        t = s.get(Tasting, tid)
        if not t or (uid and t.user_id != uid):
            return None

        photo_count = (
            s.execute(select(func.count(Photo.id)).where(Photo.tasting_id == tid))
            .scalar_one()
        )
        photo_ids = (
            s.execute(
                select(func.coalesce(Photo.telegram_file_id, Photo.file_id))
                .where(Photo.tasting_id == tid)
                .order_by(Photo.id.asc())
                .limit(MAX_PHOTOS)
            )
            .scalars()
            .all()
        )
        return t, photo_ids, photo_count


async def send_quick_card_by_id(
    target: Union[Message, CallbackQuery], tid: int, uid: Optional[int] = None
):
    payload = await get_quick_card_payload(tid, uid)
    if not payload:
        await ui(target, "Запись не найдена.")
        return
    t, photo_ids, photo_count = payload
    text_card = build_quick_card_text(t, photo_count=photo_count or 0)
    await send_card_with_media(
        target if isinstance(target, Message) else target.message,
        tid,
        text_card,
        photo_ids,
        reply_markup=quick_card_actions_kb(tid).as_markup(),
    )


async def quick_edit_cb(call: CallbackQuery, state: FSMContext):
    try:
        _, sid = call.data.split(":", 1)
        tid = int(sid)
    except Exception:
        await call.answer()
        return

    payload = await get_quick_card_payload(tid, call.from_user.id)
    if not payload:
        await call.answer()
        return
    t, _, _ = payload
    await state.set_state(QuickEditFlow.choosing)
    await state.update_data(edit_tid=tid, edit_field=None, edit_effects=[])
    await ui(
        call,
        f"Редактирование #{t.seq_no}. Выбери поле.",
        reply_markup=quick_edit_fields_kb(tid).as_markup(),
    )
    await call.answer()


async def quick_edit_back(call: CallbackQuery, state: FSMContext):
    try:
        _, _, sid = call.data.split(":", 2)
        tid = int(sid)
    except Exception:
        await call.answer()
        return
    await send_quick_card_by_id(call, tid, call.from_user.id)
    await state.clear()
    await call.answer()


async def quick_edit_field_pick(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    tid = data.get("edit_tid")
    if not tid:
        await call.answer()
        return
    _, _, field = call.data.partition(":")
    field = field or call.data.split(":", 1)[1]

    if field == "category":
        await state.update_data(edit_field="category")
        await ui(call, "Выбери тип:", reply_markup=qedit_type_kb(tid).as_markup())
        await call.answer()
        return
    if field == "temp_c":
        await state.update_data(edit_field="temp_c")
        await ui(call, "Выбери температуру:", reply_markup=qedit_temp_kb(tid).as_markup())
        await call.answer()
        return
    if field == "gear":
        await state.update_data(edit_field="gear")
        await ui(call, "Выбери посуду:", reply_markup=qedit_gear_kb(tid).as_markup())
        await call.answer()
        return
    if field == "effects":
        payload = await get_quick_card_payload(tid, call.from_user.id)
        if not payload:
            await call.answer()
            return
        t, _, _ = payload
        effects = _parse_quick_effects_csv(t.effects_csv)
        await state.update_data(edit_field="effects", edit_effects=effects)
        await ui(
            call,
            "Выбери ощущения и нажми «Готово».",
            reply_markup=qedit_effects_kb(effects, tid).as_markup(),
        )
        await call.answer()
        return
    if field == "rating":
        await state.update_data(edit_field="rating")
        await ui(call, "Выбери оценку:", reply_markup=qedit_rating_kb(tid).as_markup())
        await call.answer()
        return

    text_prompts = {
        "name": "Введите новое название.",
        "grams": "Введите граммовку (0.1-50) или «-» чтобы очистить.",
        "aroma_dry": "Введите аромат.",
        "aroma_warmed": "Введите вкус.",
        "summary": "Введите заметку.",
    }

    if field in text_prompts:
        await state.update_data(edit_field=field)
        await ask_next(
            call,
            state,
            text_prompts[field],
            quick_edit_nav_kb(tid).as_markup(),
        )
        await state.set_state(QuickEditFlow.waiting_text)
    await call.answer()


async def quick_edit_apply_updates(
    target: Union[Message, CallbackQuery], state: FSMContext, updates: dict
):
    data = await state.get_data()
    tid = data.get("edit_tid")
    if not tid:
        await ui(target, "Контекст редактирования потерян.")
        return
    ok = update_tasting_fields(tid, target.from_user.id, **updates)
    if not ok:
        await ui(target, "Не удалось сохранить изменения.")
        return
    await state.clear()
    await ui(target, "Обновлено.")
    await send_quick_card_by_id(target, tid, target.from_user.id)


async def quick_edit_text_in(message: Message, state: FSMContext):
    data = await state.get_data()
    field = data.get("edit_field")
    tid = data.get("edit_tid")
    if not field or not tid:
        return

    text_val = (message.text or "").strip()
    updates: dict = {}
    if field == "name":
        if not text_val:
            await message.answer("Название не может быть пустым.")
            await ask_next(
                message,
                state,
                "Введите новое название.",
                quick_edit_nav_kb(tid).as_markup(),
            )
            await state.set_state(QuickEditFlow.waiting_text)
            return
        updates = {"name": text_val}
    elif field == "grams":
        if text_val == "-":
            updates = {"grams": None}
        else:
            try:
                updates = {"grams": parse_grams_value(text_val)}
            except ValueError as exc:
                await message.answer(str(exc))
                await ask_next(
                    message,
                    state,
                    "Введите граммовку (0.1-50) или «-» чтобы очистить.",
                    quick_edit_nav_kb(tid).as_markup(),
                )
                await state.set_state(QuickEditFlow.waiting_text)
                return
    elif field == "aroma_dry":
        updates = {"aroma_dry": text_val or None}
    elif field == "aroma_warmed":
        updates = {"aroma_warmed": text_val or None}
    elif field == "summary":
        updates = {"summary": text_val or None}
    elif field == "category":
        updates = {"category": text_val or None}
    elif field == "gear":
        updates = {"gear": text_val or None}
    elif field == "effects_other":
        effects = list(data.get("edit_effects", []) or [])
        if text_val:
            effects.append(text_val)
        await state.update_data(edit_effects=effects, edit_field="effects")
        await ui(
            message,
            "Выбери ощущения и нажми «Готово».",
            reply_markup=qedit_effects_kb(effects, tid).as_markup(),
        )
        await state.set_state(QuickEditFlow.choosing)
        return
    else:
        return

    await quick_edit_apply_updates(message, state, updates)


async def quick_edit_type_pick(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    tid = data.get("edit_tid")
    if not tid:
        await call.answer()
        return
    _, _, tail = call.data.partition(":")
    _, _, code = tail.partition(":")
    if code == "other":
        await state.set_state(QuickEditFlow.waiting_text)
        await state.update_data(edit_field="category")
        await ask_next(
            call,
            state,
            "Введите тип чая.",
            quick_edit_nav_kb(tid).as_markup(),
        )
        await call.answer()
        return
    value = QUICK_CATEGORIES.get(code)
    await quick_edit_apply_updates(call, state, {"category": value})
    await call.answer()


async def quick_edit_temp_pick(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    tid = data.get("edit_tid")
    if not tid:
        await call.answer()
        return
    _, _, tail = call.data.partition(":")
    _, _, raw_val = tail.partition(":")
    try:
        val = int(raw_val)
    except ValueError:
        await call.answer()
        return
    await quick_edit_apply_updates(call, state, {"temp_c": val})
    await call.answer()


async def quick_edit_gear_pick(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    tid = data.get("edit_tid")
    if not tid:
        await call.answer()
        return
    _, _, tail = call.data.partition(":")
    _, _, code = tail.partition(":")
    if code == "other":
        await state.set_state(QuickEditFlow.waiting_text)
        await state.update_data(edit_field="gear")
        await ask_next(
            call,
            state,
            "Введите посуду.",
            quick_edit_nav_kb(tid).as_markup(),
        )
        await call.answer()
        return
    value = QUICK_GEAR.get(code)
    await quick_edit_apply_updates(call, state, {"gear": value})
    await call.answer()


async def quick_edit_eff_toggle(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    tid = data.get("edit_tid")
    if not tid:
        await call.answer()
        return
    effects: list[str] = list(data.get("edit_effects", []) or [])
    _, _, tail = call.data.partition(":")
    _, _, code = tail.partition(":")

    if code == "done":
        await quick_edit_apply_updates(call, state, {"effects_csv": ",".join(effects) or None})
        await call.answer()
        return
    if code == "other":
        await state.set_state(QuickEditFlow.waiting_text)
        await state.update_data(edit_field="effects_other")
        await ask_next(
            call,
            state,
            "Введи ощущение.",
            quick_edit_nav_kb(tid).as_markup(),
        )
        await call.answer()
        return

    label = QUICK_EFFECTS.get(code)
    if not label:
        await call.answer()
        return
    if label in effects:
        effects.remove(label)
    else:
        effects.append(label)
    await state.update_data(edit_effects=effects, edit_field="effects")
    kb = qedit_effects_kb(effects, tid)
    try:
        await call.message.edit_reply_markup(reply_markup=kb.as_markup())
    except TelegramBadRequest:
        pass
    await call.answer()


async def quick_edit_rating_pick(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    tid = data.get("edit_tid")
    if not tid:
        await call.answer()
        return
    _, _, tail = call.data.partition(":")
    _, _, raw_val = tail.partition(":")
    try:
        val = int(raw_val)
    except ValueError:
        await call.answer()
        return
    val = max(0, min(10, val))
    await quick_edit_apply_updates(call, state, {"rating": val})
    await call.answer()


# ---------------- ПОИСК / ЛЕНТА ----------------


def encode_more_payload(uid: int, min_id: int, extra: str = "") -> str:
    encoded_extra = (
        base64.urlsafe_b64encode(extra.encode("utf-8")).decode("ascii").rstrip("=")
        if extra
        else ""
    )
    return f"{uid}|{min_id}|{encoded_extra}"


def decode_more_payload(payload: str) -> Tuple[int, int, str]:
    parts = payload.split("|", 2)
    if len(parts) < 2:
        raise ValueError
    uid = int(parts[0])
    min_id = int(parts[1])
    extra_enc = parts[2] if len(parts) > 2 else ""
    if extra_enc:
        padding = "=" * (-len(extra_enc) % 4)
        extra = base64.urlsafe_b64decode(extra_enc + padding).decode("utf-8")
    else:
        extra = ""
    return uid, min_id, extra


def apply_search_filters(stmt, kind: str, extra: str):
    extra_clean = (extra or "").strip()
    if kind == "last":
        return stmt
    if kind == "name":
        if not extra_clean:
            return None
        return stmt.where(Tasting.name.ilike(f"%{extra_clean}%"))
    if kind == "cat":
        if not extra_clean:
            return None
        return stmt.where(Tasting.category.ilike(extra_clean))
    if kind == "year":
        if not extra_clean.isdigit():
            return None
        return stmt.where(Tasting.year == int(extra_clean))
    if kind == "rating":
        try:
            thr = int(extra_clean)
        except Exception:
            return None
        return stmt.where(Tasting.rating >= thr)
    return None


def fetch_tastings_page(
    uid: int, kind: str, extra: str, min_id: Optional[int] = None
) -> Tuple[List[Tasting], bool]:
    with SessionLocal() as s:
        stmt = select(Tasting).where(Tasting.user_id == uid)
        stmt = apply_search_filters(stmt, kind, extra)
        if stmt is None:
            return [], False
        if min_id is not None:
            stmt = stmt.where(Tasting.id < min_id)
        stmt = stmt.order_by(Tasting.id.desc()).limit(PAGE_SIZE)
        rows = s.execute(stmt).scalars().all()
        if not rows:
            return [], False

        next_stmt = select(Tasting.id).where(Tasting.user_id == uid)
        next_stmt = apply_search_filters(next_stmt, kind, extra)
        if next_stmt is None:
            return rows, False
        next_stmt = next_stmt.where(Tasting.id < rows[-1].id)
        next_stmt = next_stmt.order_by(Tasting.id.desc()).limit(1)
        more = s.execute(next_stmt).scalars().first() is not None
        return rows, more


def more_allowed(uid: int) -> bool:
    now = time.monotonic()
    last = MORE_THROTTLE.get(uid, 0.0)
    if now - last < MORE_THROTTLE_INTERVAL:
        return False
    MORE_THROTTLE[uid] = now
    return True


async def find_cb(call: CallbackQuery):
    await ui(
        call,
        "Выбери способ поиска:",
        reply_markup=search_menu_kb().as_markup(),
    )
    await call.answer()


async def find_cmd(message: Message):
    await message.answer(
        "Выбери способ поиска:",
        reply_markup=search_menu_kb().as_markup(),
    )


async def s_last(call: CallbackQuery):
    uid = call.from_user.id
    rows, has_more = fetch_tastings_page(uid, "last", "")

    if not rows:
        await call.message.answer(
            "Пока пусто.", reply_markup=search_menu_kb().as_markup()
        )
        await call.answer()
        return

    await call.message.answer("Последние записи:")
    for t in rows:
        await call.message.answer(
            short_row(t),
            reply_markup=open_btn_kb(t.id).as_markup(),
        )

    if has_more:
        payload = encode_more_payload(uid, rows[-1].id)
        await call.message.answer(
            "Показать ещё:",
            reply_markup=more_btn_kb("last", payload).as_markup(),
        )

    await call.message.answer(
        "Ещё варианты:", reply_markup=search_menu_kb().as_markup()
    )
    await call.answer()


async def last_cmd(message: Message):
    uid = message.from_user.id
    rows, has_more = fetch_tastings_page(uid, "last", "")

    if not rows:
        await message.answer(
            "Пока пусто.", reply_markup=search_menu_kb().as_markup()
        )
        return

    await message.answer("Последние записи:")
    for t in rows:
        await message.answer(
            short_row(t),
            reply_markup=open_btn_kb(t.id).as_markup(),
        )

    if has_more:
        payload = encode_more_payload(uid, rows[-1].id)
        await message.answer(
            "Показать ещё:",
            reply_markup=more_btn_kb("last", payload).as_markup(),
        )

    await message.answer(
        "Ещё варианты:", reply_markup=search_menu_kb().as_markup()
    )


def _try_parse_date(value: str) -> Optional[datetime.date]:
    cleaned = (value or "").strip()
    for fmt in ("%Y-%m-%d", "%Y.%m.%d", "%d.%m.%Y", "%d.%m", "%d/%m", "%d-%m"):
        try:
            dt = datetime.datetime.strptime(cleaned, fmt)
            return dt.date()
        except ValueError:
            continue
    return None


def format_note_date(t: Tasting) -> str:
    if t.tasted_at:
        parsed = _try_parse_date(t.tasted_at)
        if parsed:
            return parsed.strftime("%d.%m")
    if getattr(t, "created_at", None):
        return t.created_at.strftime("%d.%m")
    return "--.--"


def format_note_title(t: Tasting) -> str:
    parts: List[str] = [t.name]
    extra: List[str] = []
    if t.year:
        extra.append(str(t.year))
    if t.region:
        extra.append(t.region)
    if extra:
        parts.append(f"({', '.join(extra)})")
    full_title = " ".join(parts).strip()
    if len(full_title) <= NOTES_TITLE_MAX_LEN:
        return full_title
    return full_title[: NOTES_TITLE_MAX_LEN - 1].rstrip() + "…"


def format_note_row(t: Tasting) -> str:
    icon = "⚡️ " if getattr(t, "entry_mode", "full") == "quick" else ""
    date = format_note_date(t)
    title = format_note_title(t)
    rating = "–" if t.rating is None else str(t.rating)
    return f"{icon}{date} · {t.category} · {title} · {rating}"


def fetch_notes_page(uid: int, page: int) -> tuple[List[Tasting], int, int, int]:
    with SessionLocal() as s:
        total = (
            s.execute(select(func.count(Tasting.id)).where(Tasting.user_id == uid))
            .scalar_one()
            or 0
        )
        pages = max(1, math.ceil(total / PAGE_SIZE)) if total else 1
        page_idx = min(max(page, 0), max(pages - 1, 0))
        tastings = (
            s.execute(
                select(Tasting)
                .where(Tasting.user_id == uid)
                .order_by(Tasting.id.desc())
                .limit(PAGE_SIZE)
                .offset(page_idx * PAGE_SIZE)
            )
            .scalars()
            .all()
        )
    return tastings, total, page_idx, pages


def notes_list_text(total: int, page: int, pages: int) -> str:
    header = f"Мои дегустации · {total} записей · стр. {page + 1}/{pages}"
    if total:
        return (
            header
            + "\n\n"
            + "Последние 5 записей. Нажми на строку, чтобы открыть карточку."
        )
    return header + "\n\nПока нет записей."


def notes_list_kb(items: List[Tasting], page: int, pages: int) -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    for t in items:
        kb.button(text=format_note_row(t), callback_data=f"notes:open:{t.id}")
    nav_buttons = []
    if page > 0:
        nav_buttons.append(
            InlineKeyboardButton(text="⬅️ Назад", callback_data=f"notes:prev:{page - 1}")
        )
    if page < pages - 1:
        nav_buttons.append(
            InlineKeyboardButton(text="Вперёд ➡️", callback_data=f"notes:next:{page + 1}")
        )
    if items:
        kb.adjust(1)
    if nav_buttons:
        kb.row(*nav_buttons)
    kb.row(InlineKeyboardButton(text="В меню", callback_data="back:main"))
    return kb.as_markup()


async def render_notes_list(
    target: Union[Message, CallbackQuery], uid: int, page: int, *, edit: bool = False
):
    items, total, page_idx, pages = fetch_notes_page(uid, page)
    text = notes_list_text(total, page_idx, pages)
    markup = notes_list_kb(items, page_idx, pages)

    if edit:
        await ui(target, text, reply_markup=markup)
    else:
        if isinstance(target, CallbackQuery):
            await target.message.answer(text, reply_markup=markup)
        else:
            await target.answer(text, reply_markup=markup)


async def notes_cmd(message: Message):
    await render_notes_list(message, message.from_user.id, 0, edit=False)


async def notes_list_cb(call: CallbackQuery):
    try:
        _, _, page_raw = call.data.split(":", 2)
        page = int(page_raw)
    except Exception:
        await call.answer()
        return

    await render_notes_list(call, call.from_user.id, page, edit=True)
    await call.answer()


async def notes_prev_next_cb(call: CallbackQuery):
    try:
        _, _, page_raw = call.data.split(":", 2)
        page = int(page_raw)
    except Exception:
        await call.answer()
        return

    await render_notes_list(call, call.from_user.id, page, edit=True)
    await call.answer()


def load_tasting_details(tid: int, uid: int):
    with SessionLocal() as s:
        t = s.get(Tasting, tid)
        if not t or t.user_id != uid:
            return None

        inf_list = (
            s.execute(
                select(Infusion)
                .where(Infusion.tasting_id == tid)
                .order_by(Infusion.n)
            )
            .scalars()
            .all()
        )
        infusions_data = [
            {
                "n": inf.n,
                "seconds": inf.seconds,
                "liquor_color": inf.liquor_color,
                "taste": inf.taste,
                "special_notes": inf.special_notes,
                "body": inf.body,
                "aftertaste": inf.aftertaste,
            }
            for inf in inf_list
        ]

        photo_count = (
            s.execute(select(func.count(Photo.id)).where(Photo.tasting_id == tid))
            .scalar_one()
        )
        photo_ids = (
            s.execute(
                select(func.coalesce(Photo.telegram_file_id, Photo.file_id))
                .where(Photo.tasting_id == tid)
                .order_by(Photo.id.asc())
                .limit(MAX_PHOTOS)
            )
            .scalars()
            .all()
        )

        is_quick = getattr(t, "entry_mode", "full") == "quick"

    return t, infusions_data, photo_ids, is_quick, photo_count


async def notes_open_cb(call: CallbackQuery, state: FSMContext):
    try:
        _, _, sid = call.data.split(":", 2)
        tid = int(sid)
    except Exception:
        await call.answer()
        return

    details = load_tasting_details(tid, call.from_user.id)
    if not details:
        await call.message.answer("Запись не найдена.")
        await call.answer()
        return

    t, infusions_data, photo_ids, is_quick, photo_count = details
    if is_quick:
        card_text = build_quick_card_text(t, photo_count=photo_count or 0)
    else:
        card_text = build_card_text(t, infusions_data, photo_count=photo_count or 0)

    actions_markup = notes_card_actions_kb(t.id, is_quick=is_quick).as_markup()
    sent = await send_card_with_media(
        call.message,
        t.id,
        card_text,
        photo_ids,
        reply_markup=actions_markup,
        collect_message_ids=True,
    )

    if sent:
        message_ids, action_message_id = sent
        if action_message_id:
            data = await state.get_data()
            cards = data.get("notes_cards", {})
            cards[action_message_id] = message_ids
            await state.update_data(notes_cards=cards)
        logger.debug(
            "notes_open_cb: actions_message_id=%s, card_len=%s",
            action_message_id,
            len(message_ids),
        )
    await call.answer()


async def notes_back_cb(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    cards = data.get("notes_cards", {})
    message_ids = cards.pop(call.message.message_id, None)

    logger.debug(
        "notes_back_cb: message_id=%s, found=%s",
        call.message.message_id,
        bool(message_ids),
    )

    if message_ids:
        chat_id = call.message.chat.id
        for mid in message_ids:
            with suppress(Exception):
                await call.message.bot.delete_message(chat_id, mid)
        await state.update_data(notes_cards=cards)
    else:
        with suppress(Exception):
            await call.message.delete()
    await call.answer()


async def more_last(call: CallbackQuery):
    _, _, payload = call.data.split(":", 2)
    try:
        uid_payload, cursor, extra = decode_more_payload(payload)
    except Exception:
        await call.answer()
        return

    if uid_payload != call.from_user.id:
        try:
            await call.message.edit_reply_markup()
        except TelegramBadRequest:
            pass
        await call.message.answer(
            "Контекст поиска устарел. Запусти поиск заново.",
            reply_markup=search_menu_kb().as_markup(),
        )
        await call.answer()
        return

    if not more_allowed(call.from_user.id):
        await call.answer("Слишком часто. Подожди секунду.")
        return

    rows, has_more = fetch_tastings_page(call.from_user.id, "last", extra, min_id=cursor)

    try:
        await call.message.edit_reply_markup()
    except TelegramBadRequest:
        pass

    if not rows:
        await call.message.answer(
            "Больше записей нет.", reply_markup=search_menu_kb().as_markup()
        )
        await call.answer()
        return

    for t in rows:
        await call.message.answer(
            short_row(t),
            reply_markup=open_btn_kb(t.id).as_markup(),
        )

    if has_more:
        payload2 = encode_more_payload(call.from_user.id, rows[-1].id, extra)
        await call.message.answer(
            "Показать ещё:",
            reply_markup=more_btn_kb("last", payload2).as_markup(),
        )

    await call.answer()


# --- поиск по названию

async def s_name(call: CallbackQuery, state: FSMContext):
    await ui(call, "Введи часть названия чая:")
    await state.set_state(SearchFlow.name)
    await call.answer()


async def s_name_run(message: Message, state: FSMContext):
    q = message.text.strip()
    uid = message.from_user.id
    rows, has_more = fetch_tastings_page(uid, "name", q)

    await state.clear()

    if not rows:
        await message.answer(
            "Ничего не нашёл.",
            reply_markup=search_menu_kb().as_markup(),
        )
        return

    await message.answer("Найдено:")
    for t in rows:
        await message.answer(
            short_row(t),
            reply_markup=open_btn_kb(t.id).as_markup(),
        )

    if has_more:
        await message.answer(
            "Показать ещё:",
            reply_markup=more_btn_kb(
                "name", encode_more_payload(uid, rows[-1].id, q)
            ).as_markup(),
        )

    await message.answer(
        "Ещё варианты:", reply_markup=search_menu_kb().as_markup()
    )


async def more_name(call: CallbackQuery):
    _, _, payload = call.data.split(":", 2)
    try:
        uid_payload, cursor, extra = decode_more_payload(payload)
    except Exception:
        await call.answer()
        return

    if uid_payload != call.from_user.id:
        try:
            await call.message.edit_reply_markup()
        except TelegramBadRequest:
            pass
        await call.message.answer(
            "Контекст поиска устарел. Запусти поиск заново.",
            reply_markup=search_menu_kb().as_markup(),
        )
        await call.answer()
        return

    if not more_allowed(call.from_user.id):
        await call.answer("Слишком часто. Подожди секунду.")
        return

    rows, has_more = fetch_tastings_page(
        call.from_user.id, "name", extra, min_id=cursor
    )

    try:
        await call.message.edit_reply_markup()
    except TelegramBadRequest:
        pass

    if not rows:
        await call.message.answer(
            "Больше результатов нет.",
            reply_markup=search_menu_kb().as_markup(),
        )
        await call.answer()
        return

    for t in rows:
        await call.message.answer(
            short_row(t),
            reply_markup=open_btn_kb(t.id).as_markup(),
        )

    if has_more:
        await call.message.answer(
            "Показать ещё:",
            reply_markup=more_btn_kb(
                "name",
                encode_more_payload(call.from_user.id, rows[-1].id, extra),
            ).as_markup(),
        )

    await call.answer()


# --- поиск по категории

async def s_cat(call: CallbackQuery, state: FSMContext):
    await ui(
        call,
        "Выбери категорию или укажи вручную:",
        reply_markup=category_search_kb().as_markup(),
    )
    await state.clear()
    await call.answer()


async def s_cat_pick(call: CallbackQuery):
    _, val = call.data.split(":", 1)
    uid = call.from_user.id

    if val == "__other__":
        await ui(call, "Введи категорию текстом:")
        await call.answer()
        return

    rows, has_more = fetch_tastings_page(uid, "cat", val)

    if not rows:
        await call.message.answer(
            "Ничего не нашёл.",
            reply_markup=search_menu_kb().as_markup(),
        )
        await call.answer()
        return

    await call.message.answer(f"Найдено по категории «{val}»:")
    for t in rows:
        await call.message.answer(short_row(t), reply_markup=open_btn_kb(t.id).as_markup())

    if has_more:
        await call.message.answer(
            "Показать ещё:",
            reply_markup=more_btn_kb(
                "cat", encode_more_payload(uid, rows[-1].id, val)
            ).as_markup(),
        )
    await call.answer()


async def s_cat_text(message: Message, state: FSMContext):
    q = (message.text or "").strip()
    uid = message.from_user.id

    rows, has_more = fetch_tastings_page(uid, "cat", q)

    if not rows:
        await message.answer("Ничего не нашёл.", reply_markup=search_menu_kb().as_markup())
        return

    await message.answer(f"Найдено по категории «{q}»:")
    for t in rows:
        await message.answer(short_row(t), reply_markup=open_btn_kb(t.id).as_markup())

    if has_more:
        await message.answer(
            "Показать ещё:",
            reply_markup=more_btn_kb(
                "cat", encode_more_payload(uid, rows[-1].id, q)
            ).as_markup(),
        )


async def more_cat(call: CallbackQuery):
    _, _, payload = call.data.split(":", 2)
    try:
        uid_payload, cursor, extra = decode_more_payload(payload)
    except Exception:
        await call.answer()
        return

    if uid_payload != call.from_user.id:
        try:
            await call.message.edit_reply_markup()
        except TelegramBadRequest:
            pass
        await call.message.answer(
            "Контекст поиска устарел. Запусти поиск заново.",
            reply_markup=search_menu_kb().as_markup(),
        )
        await call.answer()
        return

    if not more_allowed(call.from_user.id):
        await call.answer("Слишком часто. Подожди секунду.")
        return

    rows, has_more = fetch_tastings_page(
        call.from_user.id, "cat", extra, min_id=cursor
    )

    try:
        await call.message.edit_reply_markup()
    except TelegramBadRequest:
        pass

    if not rows:
        await call.message.answer(
            "Больше результатов нет.", reply_markup=search_menu_kb().as_markup()
        )
        await call.answer()
        return

    for t in rows:
        await call.message.answer(short_row(t), reply_markup=open_btn_kb(t.id).as_markup())

    if has_more:
        await call.message.answer(
            "Показать ещё:",
            reply_markup=more_btn_kb(
                "cat", encode_more_payload(call.from_user.id, rows[-1].id, extra)
            ).as_markup(),
        )
    await call.answer()


# --- поиск по году

async def s_year(call: CallbackQuery, state: FSMContext):
    await ui(
        call,
        "Введи год (4 цифры):",
    )
    await state.set_state(SearchFlow.year)
    await call.answer()


async def s_year_run(message: Message, state: FSMContext):
    txt = (message.text or "").strip()
    if not txt.isdigit():
        await message.answer("Нужно число, например 2020.", reply_markup=search_menu_kb().as_markup())
        await state.clear()
        return
    year = int(txt)
    uid = message.from_user.id
    rows, has_more = fetch_tastings_page(uid, "year", str(year))
    await state.clear()

    if not rows:
        await message.answer("Ничего не нашёл.", reply_markup=search_menu_kb().as_markup())
        return

    await message.answer(f"Найдено за {year}:")
    for t in rows:
        await message.answer(short_row(t), reply_markup=open_btn_kb(t.id).as_markup())

    if has_more:
        await message.answer(
            "Показать ещё:",
            reply_markup=more_btn_kb(
                "year", encode_more_payload(uid, rows[-1].id, str(year))
            ).as_markup(),
        )


async def more_year(call: CallbackQuery):
    _, _, payload = call.data.split(":", 2)
    try:
        uid_payload, cursor, extra = decode_more_payload(payload)
    except Exception:
        await call.answer()
        return

    if uid_payload != call.from_user.id:
        try:
            await call.message.edit_reply_markup()
        except TelegramBadRequest:
            pass
        await call.message.answer(
            "Контекст поиска устарел. Запусти поиск заново.",
            reply_markup=search_menu_kb().as_markup(),
        )
        await call.answer()
        return

    if not more_allowed(call.from_user.id):
        await call.answer("Слишком часто. Подожди секунду.")
        return

    rows, has_more = fetch_tastings_page(
        call.from_user.id, "year", extra, min_id=cursor
    )

    try:
        await call.message.edit_reply_markup()
    except TelegramBadRequest:
        pass

    if not rows:
        await call.message.answer("Больше результатов нет.", reply_markup=search_menu_kb().as_markup())
        await call.answer()
        return

    for t in rows:
        await call.message.answer(short_row(t), reply_markup=open_btn_kb(t.id).as_markup())

    if has_more:
        await call.message.answer(
            "Показать ещё:",
            reply_markup=more_btn_kb(
                "year",
                encode_more_payload(call.from_user.id, rows[-1].id, extra),
            ).as_markup(),
        )
    await call.answer()


# --- поиск по рейтингу (не ниже X)

async def s_rating(call: CallbackQuery):
    await ui(call, "Минимальная оценка?", reply_markup=rating_filter_kb().as_markup())
    await call.answer()


async def rating_filter_pick(call: CallbackQuery):
    _, val = call.data.split(":", 1)
    try:
        thr = int(val)
    except Exception:
        await call.answer()
        return

    uid = call.from_user.id
    rows, has_more = fetch_tastings_page(uid, "rating", str(thr))

    if not rows:
        await call.message.answer("Ничего не нашёл.", reply_markup=search_menu_kb().as_markup())
        await call.answer()
        return

    await call.message.answer(f"Найдено с оценкой ≥ {thr}:")
    for t in rows:
        await call.message.answer(short_row(t), reply_markup=open_btn_kb(t.id).as_markup())

    if has_more:
        await call.message.answer(
            "Показать ещё:",
            reply_markup=more_btn_kb(
                "rating", encode_more_payload(uid, rows[-1].id, str(thr))
            ).as_markup(),
        )
    await call.answer()


async def more_rating(call: CallbackQuery):
    _, _, payload = call.data.split(":", 2)
    try:
        uid_payload, cursor, extra = decode_more_payload(payload)
    except Exception:
        await call.answer()
        return

    if uid_payload != call.from_user.id:
        try:
            await call.message.edit_reply_markup()
        except TelegramBadRequest:
            pass
        await call.message.answer(
            "Контекст поиска устарел. Запусти поиск заново.",
            reply_markup=search_menu_kb().as_markup(),
        )
        await call.answer()
        return

    if not more_allowed(call.from_user.id):
        await call.answer("Слишком часто. Подожди секунду.")
        return

    rows, has_more = fetch_tastings_page(
        call.from_user.id, "rating", extra, min_id=cursor
    )

    try:
        await call.message.edit_reply_markup()
    except TelegramBadRequest:
        pass

    if not rows:
        await call.message.answer("Больше результатов нет.", reply_markup=search_menu_kb().as_markup())
        await call.answer()
        return

    for t in rows:
        await call.message.answer(short_row(t), reply_markup=open_btn_kb(t.id).as_markup())

    if has_more:
        await call.message.answer(
            "Показать ещё:",
            reply_markup=more_btn_kb(
                "rating", encode_more_payload(call.from_user.id, rows[-1].id, extra)
            ).as_markup(),
        )
    await call.answer()


# ---------------- ОТКРЫТИЕ / РЕДАКТ / УДАЛЕНИЕ ----------------

async def open_card(call: CallbackQuery):
    try:
        _, sid = call.data.split(":", 1)
        tid = int(sid)
    except Exception:
        await call.answer()
        return

    details = load_tasting_details(tid, call.from_user.id)
    if not details:
        await call.message.answer("Запись не найдена.")
        await call.answer()
        return

    t, infusions_data, photo_ids, is_quick, photo_count = details
    if is_quick:
        card_text = build_quick_card_text(t, photo_count=photo_count or 0)
        actions_markup = quick_card_actions_kb(t.id).as_markup()
    else:
        card_text = build_card_text(
            t, infusions_data, photo_count=photo_count or 0
        )
        actions_markup = card_actions_kb(t.id).as_markup()
    await send_card_with_media(
        call.message,
        t.id,
        card_text,
        photo_ids,
        reply_markup=actions_markup,
    )
    await call.answer()


def edit_context_home_markup() -> InlineKeyboardMarkup:
    kb = InlineKeyboardMarkup()
    kb.add(InlineKeyboardButton("⬅️ В меню", callback_data="nav:home"))
    return kb


async def notify_edit_context_lost(event: Union[CallbackQuery, Message], state: FSMContext):
    data = await state.get_data()
    if data.get("edit_ctx_warned"):
        return
    await ui(
        event,
        "Контекст редактирования потерян.",
        reply_markup=edit_context_home_markup(),
    )
    await state.update_data(edit_ctx_warned=True)


async def ensure_edit_context(event: Union[CallbackQuery, Message], state: FSMContext):
    """
    Проверяет валидность контекста редактирования.
    Возвращает dict с { 'tid': int, 'field': Optional[str], 'seq_no': Optional[int] } если валиден.
    Если контекст потерян — показывает сообщение с кнопкой '⬅️ В меню' (однократно) и возвращает None.
    """
    data = await state.get_data()
    current_state = await state.get_state()
    editing_states = {EditFlow.choosing.state, EditFlow.waiting_text.state}

    tid = data.get("edit_t_id")
    field = data.get("edit_field")
    seq_no = data.get("edit_seq_no")

    if not tid or seq_no is None:
        if current_state in editing_states:
            logger.warning(
                "Edit context missing (state=%s, tid=%s, seq=%s)",
                current_state,
                tid,
                seq_no,
            )
            await notify_edit_context_lost(event, state)
            return None
        if data.get("edit_ctx_warned"):
            await state.update_data(edit_ctx_warned=False)
        return {"tid": tid, "field": field, "seq_no": seq_no}

    if isinstance(event, CallbackQuery):
        uid = event.from_user.id
    elif isinstance(event, Message):
        uid = event.from_user.id
    else:
        uid = getattr(getattr(event, "from_user", None), "id", None)
        if uid is None and hasattr(event, "message"):
            uid = getattr(event.message.from_user, "id", None)

    if uid is None:
        logger.warning("Unable to determine user for edit context check (tid=%s)", tid)
        await notify_edit_context_lost(event, state)
        return None

    try:
        with SessionLocal() as s:
            t = s.get(Tasting, tid)
            if not t or t.user_id != uid:
                logger.warning("Edit context invalid owner (tid=%s, uid=%s)", tid, uid)
                await notify_edit_context_lost(event, state)
                return None
    except Exception:
        logger.exception("Failed to verify edit context (tid=%s)", tid)
        await notify_edit_context_lost(event, state)
        return None

    if data.get("edit_ctx_warned"):
        await state.update_data(edit_ctx_warned=False)

    return {"tid": tid, "field": field, "seq_no": seq_no}


def prepare_text_edit(field: str, raw: str) -> Tuple[Optional[Union[str, int, float]], Optional[str], Optional[str]]:
    cfg = EDIT_TEXT_FIELDS[field]
    text = (raw or "").strip()
    if not text:
        return None, cfg["prompt"], None

    if text == "-":
        if cfg["allow_clear"]:
            return None, None, cfg["column"]
        return None, cfg["prompt"], None

    if field == "name":
        if text == "-":
            return None, cfg["prompt"], None
        return text, None, cfg["column"]
    if field == "year":
        try:
            value = parse_year_value(text)
        except ValueError as exc:
            return None, f"{exc} {cfg['prompt']}", None
        return value, None, cfg["column"]
    if field == "grams":
        try:
            value = parse_grams_value(text)
        except ValueError as exc:
            return None, f"{exc} {cfg['prompt']}", None
        return value, None, cfg["column"]
    if field == "temp_c":
        try:
            value = parse_temp_value(text)
        except ValueError as exc:
            return None, f"{exc} {cfg['prompt']}", None
        return value, None, cfg["column"]
    if field == "tasted_at":
        try:
            datetime.datetime.strptime(text, "%H:%M")
        except ValueError:
            return None, "Время должно быть в формате HH:MM. " + cfg["prompt"], None
        return text, None, cfg["column"]
    if field in {"effects", "scenarios"}:
        normalized = normalize_csv_text(text)
        if not normalized:
            return None, cfg["prompt"], None
        return normalized, None, cfg["column"]
    # остальные текстовые поля — просто сохраняем строку
    return text, None, cfg["column"]


def update_tasting_fields(tid: int, uid: int, **updates) -> bool:
    if not updates:
        return False
    with SessionLocal() as s:
        t = s.get(Tasting, tid)
        if not t or t.user_id != uid:
            return False
        for key, value in updates.items():
            setattr(t, key, value)
        s.commit()
    return True


async def send_edit_menu(target: Union[CallbackQuery, Message], seq_no: int):
    markup = edit_fields_kb().as_markup()
    text = edit_menu_text(seq_no)
    if isinstance(target, CallbackQuery):
        await target.message.answer(text, reply_markup=markup)
    else:
        await target.answer(text, reply_markup=markup)


async def edit_cb(call: CallbackQuery, state: FSMContext):
    ctx = await ensure_edit_context(call, state)
    if ctx is None:
        await call.answer()
        return

    try:
        _, sid = call.data.split(":", 1)
        tid = int(sid)
    except Exception:
        await call.answer()
        return

    try:
        with SessionLocal() as s:
            t = s.get(Tasting, tid)
            if not t or t.user_id != call.from_user.id:
                await call.message.answer("Нет доступа к этой записи.")
                await call.answer()
                return
            seq_no = t.seq_no
            entry_mode = getattr(t, "entry_mode", "full") or "full"

        if entry_mode == "quick":
            await state.clear()
            await state.set_state(QuickEditFlow.choosing)
            await state.update_data(
                edit_tid=tid, edit_field=None, edit_effects=[]
            )
            await ui(
                call,
                f"Редактирование #{seq_no}. Выбери поле.",
                reply_markup=quick_edit_fields_kb(tid).as_markup(),
            )
            await call.answer()
            return

        await state.clear()
        await state.set_state(EditFlow.choosing)
        await state.update_data(
            edit_t_id=tid,
            edit_seq_no=seq_no,
            edit_field=None,
            awaiting_category_text=False,
            edit_ctx_warned=False,
        )
        await send_edit_menu(call, seq_no)
        await call.answer()
    except Exception:
        logger.exception("edit flow failed")
        await notify_edit_context_lost(call, state)
        await call.answer()


async def del_cb(call: CallbackQuery):
    try:
        _, sid = call.data.split(":", 1)
        tid = int(sid)
    except Exception:
        await call.answer()
        return
    with SessionLocal() as s:
        t = s.get(Tasting, tid)
        if not t or t.user_id != call.from_user.id:
            await call.message.answer("Нет доступа к этой записи.")
            await call.answer()
            return
    await call.message.answer(
        f"Удалить #{t.seq_no}?",
        reply_markup=confirm_del_kb(tid).as_markup(),
    )
    await call.answer()


async def del_ok_cb(call: CallbackQuery):
    try:
        _, sid = call.data.split(":", 1)
        tid = int(sid)
    except Exception:
        await call.answer()
        return
    with SessionLocal() as s:
        t = s.get(Tasting, tid)
        if not t or t.user_id != call.from_user.id:
            await call.message.answer("Нет доступа к этой записи.")
            await call.answer()
            return
        # Чистим файлы фото из хранилища до удаления записей (best-effort)
        from app.services.storage import delete_object

        for photo in s.query(Photo).filter(Photo.tasting_id == t.id).all():
            delete_object(photo.object_key, photo.storage_backend)
            delete_object(photo.thumb_object_key, photo.storage_backend)
        s.delete(t)
        s.commit()
    await call.message.answer(f"Удалил #{t.seq_no}.")
    await call.answer()


async def del_no_cb(call: CallbackQuery):
    await call.message.answer("Ок, не удаляю.")
    await call.answer()


async def edit_field_select(call: CallbackQuery, state: FSMContext):
    ctx = await ensure_edit_context(call, state)
    if ctx is None:
        await call.answer()
        return

    try:
        _, field = call.data.split(":", 1)
    except ValueError:
        await call.answer()
        return

    tid = ctx.get("tid")
    seq_no = ctx.get("seq_no")
    if not tid or seq_no is None:
        await notify_edit_context_lost(call, state)
        await call.answer()
        return

    try:
        if field == "cancel":
            await call.message.answer("Редактирование отменено.")
            await state.clear()
            await show_main_menu(call.message.bot, call.from_user.id)
            await call.answer()
            return

        if field == "category":
            await state.update_data(
                edit_field="category",
                awaiting_category_text=False,
                edit_ctx_warned=False,
            )
            await call.message.answer(
                "Выбери категорию:", reply_markup=edit_category_kb().as_markup()
            )
            await call.answer()
            return

        if field == "rating":
            await state.update_data(edit_field="rating", edit_ctx_warned=False)
            await call.message.answer(
                "Выбери оценку:", reply_markup=edit_rating_kb().as_markup()
            )
            await call.answer()
            return

        if field not in EDIT_TEXT_FIELDS:
            await call.answer()
            return

        cfg = EDIT_TEXT_FIELDS[field]
        await state.update_data(
            edit_field=field,
            awaiting_category_text=False,
            edit_ctx_warned=False,
        )
        await state.set_state(EditFlow.waiting_text)
        await call.message.answer(cfg["prompt"])
        await call.answer()
    except Exception:
        logger.exception("edit flow failed")
        await notify_edit_context_lost(call, state)
        await call.answer()


async def edit_category_pick(call: CallbackQuery, state: FSMContext):
    ctx = await ensure_edit_context(call, state)
    if ctx is None:
        await call.answer()
        return

    try:
        _, raw = call.data.split(":", 1)
    except ValueError:
        await call.answer()
        return

    tid = ctx.get("tid")
    seq_no = ctx.get("seq_no")
    if not tid or seq_no is None:
        await notify_edit_context_lost(call, state)
        await call.answer()
        return

    try:
        if raw == "__back__":
            await state.set_state(EditFlow.choosing)
            await state.update_data(
                edit_field=None,
                awaiting_category_text=False,
                edit_ctx_warned=False,
            )
            await send_edit_menu(call, seq_no)
            await call.answer()
            return

        if raw == "__other__":
            await state.update_data(
                edit_field="category",
                awaiting_category_text=True,
                edit_ctx_warned=False,
            )
            await state.set_state(EditFlow.waiting_text)
            await call.message.answer("Пришли категорию текстом.")
            await call.answer()
            return

        if raw not in CATEGORIES:
            await call.answer()
            return

        if len(raw) > 60:
            await call.message.answer("Категория слишком длинная.")
            await call.answer()
            return

        ok = update_tasting_fields(tid, call.from_user.id, category=raw)
        if not ok:
            logger.warning("Failed to update category for tasting %s", tid)
            await notify_edit_context_lost(call, state)
            await call.answer()
            return

        await state.set_state(EditFlow.choosing)
        await state.update_data(
            edit_field=None,
            awaiting_category_text=False,
            edit_ctx_warned=False,
        )
        await call.message.answer(f"Обновил {FIELD_LABELS['category']}.")
        await send_edit_menu(call, seq_no)
        await call.answer()
    except Exception:
        logger.exception("edit flow failed")
        await notify_edit_context_lost(call, state)
        await call.answer()


async def edit_rating_pick(call: CallbackQuery, state: FSMContext):
    ctx = await ensure_edit_context(call, state)
    if ctx is None:
        await call.answer()
        return

    try:
        _, raw = call.data.split(":", 1)
        rating = int(raw)
    except Exception:
        await call.answer()
        return

    if rating < 0 or rating > 10:
        await call.answer()
        return

    tid = ctx.get("tid")
    seq_no = ctx.get("seq_no")
    if not tid or seq_no is None:
        await notify_edit_context_lost(call, state)
        await call.answer()
        return

    try:
        ok = update_tasting_fields(tid, call.from_user.id, rating=rating)
        if not ok:
            logger.warning("Failed to update rating for tasting %s", tid)
            await notify_edit_context_lost(call, state)
            await call.answer()
            return

        await state.set_state(EditFlow.choosing)
        await state.update_data(
            edit_field=None,
            awaiting_category_text=False,
            edit_ctx_warned=False,
        )
        await call.message.answer(f"Обновил {FIELD_LABELS['rating']}.")
        await send_edit_menu(call, seq_no)
        await call.answer()
    except Exception:
        logger.exception("edit flow failed")
        await notify_edit_context_lost(call, state)
        await call.answer()


async def edit_flow_msg(message: Message, state: FSMContext):
    ctx = await ensure_edit_context(message, state)
    if ctx is None:
        return

    data = await state.get_data()
    tid = ctx.get("tid")
    seq_no = ctx.get("seq_no")
    field = data.get("edit_field")
    awaiting_category = data.get("awaiting_category_text")

    if not tid or seq_no is None or not field:
        await notify_edit_context_lost(message, state)
        return

    try:
        if field == "category" and awaiting_category:
            txt = (message.text or "").strip()
            if not txt or txt == "-":
                await message.answer(
                    "Категория не может быть пустой. Пришли категорию текстом."
                )
                return
            if len(txt) > 60:
                await message.answer(
                    "Категория слишком длинная. Пришли категорию текстом покороче."
                )
                return
            ok = update_tasting_fields(tid, message.from_user.id, category=txt)
            if not ok:
                logger.warning("Failed to update category text for tasting %s", tid)
                await notify_edit_context_lost(message, state)
                return
            await state.set_state(EditFlow.choosing)
            await state.update_data(
                edit_field=None,
                awaiting_category_text=False,
                edit_ctx_warned=False,
            )
            await message.answer(f"Обновил {FIELD_LABELS['category']}.")
            await send_edit_menu(message, seq_no)
            return

        if field not in EDIT_TEXT_FIELDS:
            await notify_edit_context_lost(message, state)
            return

        value, error, column = prepare_text_edit(field, message.text or "")
        if error:
            await message.answer(error)
            return

        updates = {column: value}
        ok = update_tasting_fields(tid, message.from_user.id, **updates)
        if not ok:
            logger.warning("Failed to update field %s for tasting %s", field, tid)
            await notify_edit_context_lost(message, state)
            return

        await state.set_state(EditFlow.choosing)
        await state.update_data(
            edit_field=None,
            awaiting_category_text=False,
            edit_ctx_warned=False,
        )
        await message.answer(f"Обновил {FIELD_LABELS[field]}.")
        await send_edit_menu(message, seq_no)
    except Exception:
        logger.exception("edit flow failed")
        await notify_edit_context_lost(message, state)


async def edit_cmd(message: Message, state: FSMContext):
    parts = (message.text or "").split()
    if len(parts) < 2:
        await message.answer("Использование: /edit <id или #номер>")
        return
    target = resolve_tasting(message.from_user.id, parts[1])
    if not target:
        await message.answer("Запись не найдена.")
        return
    entry_mode = getattr(target, "entry_mode", "full") or "full"
    await state.clear()
    if entry_mode == "quick":
        await state.set_state(QuickEditFlow.choosing)
        await state.update_data(edit_tid=target.id, edit_field=None, edit_effects=[])
        await message.answer(
            f"Редактирование #{target.seq_no}. Выбери поле.",
            reply_markup=quick_edit_fields_kb(target.id).as_markup(),
        )
    else:
        await state.set_state(EditFlow.choosing)
        await state.update_data(
            edit_t_id=target.id,
            edit_seq_no=target.seq_no,
            edit_field=None,
            awaiting_category_text=False,
            edit_ctx_warned=False,
        )
        await send_edit_menu(message, target.seq_no)


async def delete_cmd(message: Message):
    parts = (message.text or "").split()
    if len(parts) < 2:
        await message.answer("Использование: /delete <id или #номер>")
        return
    target = resolve_tasting(message.from_user.id, parts[1])
    if not target:
        await message.answer("Запись не найдена.")
        return
    await message.answer(
        f"Удалить #{target.seq_no}?",
        reply_markup=confirm_del_kb(target.id).as_markup(),
    )


# ---------------- КОМАНДЫ /start /help /tz и т.п. ----------------

async def show_main_menu(bot: Bot, chat_id: int):
    caption = (
        "Привет! Новая дегустация, если хочешь записать подробно и по проливам.\n"
        "Быстрая заметка, если нужно быстро зафиксировать аромат, вкус и ощущения.\n"
        "Поиск – поиск по созданным записям.\n"
        "Мои дегустации – последние заметки с перелистыванием."
    )
    await bot.send_message(chat_id=chat_id, text=caption, reply_markup=main_kb().as_markup())


async def on_start(message: Message, state: FSMContext):
    args = message.text.split(maxsplit=1)
    payload = args[1].strip() if len(args) > 1 else ""

    if payload == "login":
        uid = message.from_user.id
        username = message.from_user.username
        get_or_create_user(uid, username)

        from app.api.auth_router import generate_login_code
        code = generate_login_code(uid)
        web_url = os.getenv("WEB_URL", "https://dmtrmkrv-tea-diary-bot-0188.twc1.net")
        login_url = f"{web_url}/auth?code={code}"

        kb = InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(text="🍵 Войти в Чайный дневник", url=login_url)
        ]])
        await message.answer(
            "Нажми кнопку ниже чтобы войти на сайт.\nСсылка действует 5 минут.",
            reply_markup=kb,
        )
        return

    await state.update_data(numpad_active=False)
    await show_main_menu(message.bot, message.chat.id)


def help_text(is_admin: bool) -> str:
    lines = [
        "Команды:",
        "/start — главное меню",
        "/help — помощь",
        "/new — новая дегустация в подробном режиме, с проливами",
        "/quick — быстрая заметка (аромат, вкус, ощущения, оценка, фото)",
        "/notes — мои дегустации",
        "/find — поиск записей",
        "/cancel — отмена текущего действия",
        "",
        "Настройки:",
        "/tz — указать часовой пояс (UTC-сдвиг). Пример: /tz +3",
    ]
    if is_admin and DIAGNOSTICS_ENABLED:
        lines.extend(
            [
                "",
                "Админ:",
                "/whoami",
                "/dbinfo",
                "/health",
            ]
        )
    return "\n".join(lines)


def help_markup() -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.button(text="◀️ В меню", callback_data="to_menu")
    kb.adjust(1)
    return kb.as_markup()


async def help_cmd(message: Message):
    uid = getattr(message.from_user, "id", None)
    is_admin = bool(uid in ADMINS)
    await message.answer(help_text(is_admin), reply_markup=help_markup())


async def cancel_cmd(message: Message, state: FSMContext):
    current_state = await state.get_state()
    if not current_state:
        await message.answer(
            "Сейчас нечего отменять.", reply_markup=main_kb().as_markup()
        )
        return

    await state.update_data(cancel_return_state=current_state)
    await state.set_state(QuickCancel.confirm)
    data = await state.get_data()
    await prompt_cancel_confirmation(
        message,
        state,
        use_live_question=data.get("flow_kind") == "quick",
    )


async def reset_cmd(message: Message, state: FSMContext):
    await cancel_cmd(message, state)


async def reset_state_cmd(message: Message, state: FSMContext):
    await state.clear()
    await state.update_data(numpad_active=False)
    await flush_user_albums(message.from_user.id, state, process=False)
    await message.answer("Сбросил состояние.")


async def menu_cmd(message: Message):
    await message.answer(
        "Включил кнопки под полем ввода.",
        reply_markup=reply_main_kb(),
    )


async def hide_cmd(message: Message):
    await message.answer("Скрываю кнопки.", reply_markup=ReplyKeyboardRemove())


async def stats_cmd(message: Message):
    uid = getattr(message.from_user, "id", None)

    user_stats = await get_user_stats(uid)
    top = ", ".join(user_stats.top_categories) if user_stats.top_categories else "пока нет"
    text = (
        "📊 Моя статистика\n\n"
        f"🍵 Дегустаций: {user_stats.total_tastings}\n"
        f"🏆 Топ категории: {top}\n"
        f"⭐ Средний рейтинг: {user_stats.average_rating}"
    )

    if uid in ADMINS:
        bot_stats = await get_bot_stats()
        text += (
            "\n\n——————————————\n"
            "🤖 Статистика бота\n\n"
            f"👥 Пользователей: {bot_stats.total_users}\n"
            f"📝 Всего дегустаций: {bot_stats.total_tastings}\n\n"
            "За последние 7 дней:\n"
            f"• Дегустаций: {bot_stats.tastings_last_7d}\n"
            f"• Активных пользователей: {bot_stats.active_users_last_7d}"
        )

    await message.answer(text)


async def reply_buttons_router(message: Message, state: FSMContext):
    t = (message.text or "").strip()
    if "Новая дегустация" in t:
        await new_cmd(message, state)
    elif "Быстрая заметка" in t:
        await quick_new_cmd(message, state)
    elif "Поиск" in t:
        await find_cmd(message)
    elif "Мои дегустации" in t:
        await notes_cmd(message)
    elif "Последние 5" in t:
        await last_cmd(message)
    elif "Помощь" in t or "О боте" in t:
        await help_cmd(message)
    elif t == "Сброс" or t == "Отмена":
        await cancel_cmd(message, state)


async def help_cb(call: CallbackQuery):
    uid = getattr(call.from_user, "id", None)
    is_admin = bool(uid in ADMINS)
    await call.message.answer(help_text(is_admin), reply_markup=help_markup())
    await call.answer()


async def tz_menu_back(call: CallbackQuery):
    await call.answer()
    chat_id = call.from_user.id
    if call.message:
        chat_id = call.message.chat.id
    with suppress(Exception):
        if call.message:
            await call.message.edit_reply_markup(reply_markup=None)
    bot = call.message.bot if call.message else call.bot
    await show_main_menu(bot, chat_id)


async def back_main(call: CallbackQuery):
    await show_main_menu(call.message.bot, call.message.chat.id)
    await call.answer()


async def nav_home(call: CallbackQuery, state: FSMContext):
    await state.update_data(edit_t_id=None, edit_field=None, edit_ctx_warned=False)
    await state.clear()
    await state.update_data(numpad_active=False)
    await show_main_menu(call.message.bot, call.from_user.id)
    await call.answer()


async def tz_cmd(message: Message):
    """
    /tz -> показать текущий сдвиг
    /tz +3, /tz -2, /tz +5:30 -> сохранить новый сдвиг
    """
    parts = (message.text or "").split(maxsplit=1)
    uid = message.from_user.id

    if len(parts) == 1:
        user = get_or_create_user(uid, message.from_user.username)
        offset_min = user.tz_offset_min or 0
        current = format_tz_offset(offset_min)
        back_markup = InlineKeyboardMarkup(
            inline_keyboard=[
                [InlineKeyboardButton(text="↩ В меню", callback_data="menu:main")]
            ]
        )
        await message.answer(
            "Твой сдвиг (UTC): "
            f"{current}\n\n"
            "Чтобы изменить:\n"
            "/tz +3\n"
            "/tz -2\n"
            "/tz +5:30",
            reply_markup=back_markup,
        )
        return

    raw = parts[1].strip()
    try:
        offset_min = parse_tz_offset(raw)
    except ValueError:
        await message.answer(TZ_OFFSET_ERROR)
        return

    set_user_timezone(uid, offset_min)
    formatted = format_tz_offset(offset_min)
    await message.answer(
        f"Запомнил {formatted}. Теперь буду подставлять твоё локальное время."
    )


# ---------------- РЕГИСТРАЦИЯ ХЭНДЛЕРОВ ----------------

def setup_handlers(dp: Dispatcher):
    if DIAGNOSTICS_ENABLED:
        dp.include_router(create_router(ADMINS, IS_PROD))

    # команды
    dp.message.register(on_start, CommandStart(deep_link=True))
    dp.message.register(on_start, CommandStart())
    dp.message.register(help_cmd, Command("help"))
    dp.message.register(cancel_cmd, Command("cancel"))
    dp.message.register(reset_cmd, Command("reset"))
    dp.message.register(reset_state_cmd, Command("resetstate"))
    dp.message.register(menu_cmd, Command("menu"))
    dp.message.register(hide_cmd, Command("hide"))
    dp.message.register(stats_cmd, Command("stats"))
    dp.message.register(new_cmd, Command("new"))
    dp.message.register(quick_new_cmd, Command("quick"))
    dp.message.register(notes_cmd, Command("notes"))
    dp.message.register(notes_cmd, Command("my"))
    dp.message.register(find_cmd, Command("find"))
    dp.message.register(last_cmd, Command("last"))
    dp.message.register(edit_cmd, Command("edit"))
    dp.message.register(delete_cmd, Command("delete"))
    dp.message.register(tz_cmd, Command("tz"))

    # STATE-хендлеры — раньше любых общих
    dp.message.register(name_in, NewTasting.name)
    dp.message.register(year_in, NewTasting.year)
    dp.message.register(region_in, NewTasting.region)
    dp.message.register(cat_custom_in, NewTasting.category)
    dp.message.register(grams_in, NewTasting.grams)
    dp.message.register(temp_in, NewTasting.temp_c)
    dp.message.register(tasted_at_in, NewTasting.tasted_at)
    dp.message.register(gear_in, NewTasting.gear)
    dp.message.register(aroma_dry_custom, NewTasting.aroma_dry)
    dp.message.register(aroma_warmed_custom, NewTasting.aroma_warmed)

    dp.message.register(inf_seconds, InfusionState.seconds)
    dp.message.register(inf_color, InfusionState.color)
    dp.message.register(taste_custom, InfusionState.taste)
    dp.message.register(inf_taste, InfusionState.taste)
    dp.message.register(inf_special, InfusionState.special)
    dp.message.register(inf_body_custom, InfusionState.body)
    dp.message.register(aftertaste_custom, InfusionState.aftertaste)

    dp.message.register(rating_in, RatingSummary.rating)
    dp.message.register(summary_in, RatingSummary.summary)

    dp.message.register(quick_name_in, QuickNote.name)
    dp.message.register(quick_type_custom_in, QuickNote.type_custom)
    dp.message.register(quick_grams_in, QuickNote.grams)
    dp.message.register(quick_gear_custom_in, QuickNote.gear_custom)
    dp.message.register(quick_aroma_in, QuickNote.aroma)
    dp.message.register(quick_taste_in, QuickNote.taste)
    dp.message.register(quick_eff_custom_in, QuickNote.eff_custom)
    dp.message.register(quick_note_in, QuickNote.note)

    dp.message.register(eff_custom, EffectsScenarios.effects)
    dp.message.register(scn_custom, EffectsScenarios.scenarios)

    dp.message.register(photo_add, StateFilter("*"), F.photo)

    # поиск (message)
    dp.message.register(s_name_run, SearchFlow.name)
    dp.message.register(s_cat_text, SearchFlow.category)
    dp.message.register(s_year_run, SearchFlow.year)

    # редактирование записи
    dp.message.register(edit_flow_msg, EditFlow.waiting_text)
    dp.message.register(quick_edit_text_in, QuickEditFlow.waiting_text)

    # reply-кнопки в самом конце!
    dp.message.register(
        reply_buttons_router,
        F.text,
        lambda m: not (m.text or "").startswith("/"),
        ~CommandStart(),
    )

    # callbacks
    dp.callback_query.register(new_cb, F.data == "new")
    dp.callback_query.register(quick_new_cb, F.data == "q:new")
    dp.callback_query.register(find_cb, F.data == "find")
    dp.callback_query.register(notes_list_cb, F.data.startswith("notes:list"))
    dp.callback_query.register(notes_prev_next_cb, F.data.startswith("notes:prev:"))
    dp.callback_query.register(notes_prev_next_cb, F.data.startswith("notes:next:"))
    dp.callback_query.register(notes_open_cb, F.data.startswith("notes:open:"))
    dp.callback_query.register(notes_back_cb, F.data == "notes:back")
    dp.callback_query.register(help_cb, F.data == "help")
    dp.callback_query.register(tz_menu_back, F.data == "menu:main")
    dp.callback_query.register(back_main, F.data == "back:main")
    dp.callback_query.register(nav_home, F.data == "nav:home")
    dp.callback_query.register(nav_home, F.data == "to_menu")

    dp.callback_query.register(nt_back, F.data == "nt:back")
    dp.callback_query.register(cat_pick, F.data.startswith("cat:"))
    dp.callback_query.register(s_cat_pick, F.data.startswith("scat:"))

    dp.callback_query.register(
        skip_year_callback, StateFilter(NewTasting.year), F.data == "skip:year"
    )
    dp.callback_query.register(
        skip_grams_callback, StateFilter(NewTasting.grams), F.data == "skip:grams"
    )
    dp.callback_query.register(
        skip_temp_callback, StateFilter(NewTasting.temp_c), F.data == "skip:temp"
    )
    dp.callback_query.register(
        inf_seconds_skip,
        StateFilter(InfusionState.seconds),
        F.data == "skip:infsec",
    )
    dp.callback_query.register(region_skip, F.data == "skip:region")
    dp.callback_query.register(time_now, F.data == "time:now")
    dp.callback_query.register(tasted_at_skip, F.data == "skip:tasted_at")
    dp.callback_query.register(gear_skip, F.data == "skip:gear")

    dp.callback_query.register(aroma_dry_toggle, F.data.startswith("ad:"))
    dp.callback_query.register(aroma_warmed_toggle, F.data.startswith("aw:"))

    dp.callback_query.register(color_skip, F.data == "skip:color")
    dp.callback_query.register(taste_toggle, F.data.startswith("taste:"))
    dp.callback_query.register(special_skip, F.data == "skip:special")
    dp.callback_query.register(inf_body_pick, F.data.startswith("body:"))
    dp.callback_query.register(aftertaste_toggle, F.data.startswith("aft:"))

    dp.callback_query.register(more_infusions, F.data == "more_inf")
    dp.callback_query.register(finish_infusions, F.data == "finish_inf")

    dp.callback_query.register(eff_toggle_or_done, F.data.startswith("eff:"))
    dp.callback_query.register(scn_toggle_or_done, F.data.startswith("scn:"))

    dp.callback_query.register(
        quick_type_pick, StateFilter(QuickNote.type_pick), F.data.startswith("q:type:")
    )
    dp.callback_query.register(
        quick_temp_pick, StateFilter(QuickNote.temp_pick), F.data.startswith("q:temp:")
    )
    dp.callback_query.register(
        quick_gear_pick, StateFilter(QuickNote.gear_pick), F.data.startswith("q:gear:")
    )
    dp.callback_query.register(
        quick_eff_toggle, StateFilter(QuickNote.eff_pick), F.data.startswith("q:eff:")
    )
    dp.callback_query.register(
        quick_rating_pick, StateFilter(QuickNote.rating), F.data.startswith("q:rate:")
    )
    dp.callback_query.register(quick_skip, F.data.startswith("q:skip:"))
    dp.callback_query.register(quick_back, F.data == "q:back")
    dp.callback_query.register(quick_cancel, F.data == "q:cancel")
    dp.callback_query.register(
        quick_cancel_router,
        StateFilter("*"),
        F.data.in_({"q:cancel:yes", "q:cancel:no"}),
    )
    dp.callback_query.register(quick_edit_back, F.data.startswith("qedit:back:"))
    dp.callback_query.register(
        quick_edit_field_pick, StateFilter(QuickEditFlow.choosing), F.data.startswith("qefld:")
    )
    dp.callback_query.register(
        quick_edit_type_pick, StateFilter(QuickEditFlow.choosing), F.data.startswith("qedit:type:")
    )
    dp.callback_query.register(
        quick_edit_temp_pick, StateFilter(QuickEditFlow.choosing), F.data.startswith("qedit:temp:")
    )
    dp.callback_query.register(
        quick_edit_gear_pick, StateFilter(QuickEditFlow.choosing), F.data.startswith("qedit:gear:")
    )
    dp.callback_query.register(
        quick_edit_eff_toggle,
        StateFilter(QuickEditFlow.choosing),
        F.data.startswith("qedit:eff:"),
    )
    dp.callback_query.register(
        quick_edit_rating_pick,
        StateFilter(QuickEditFlow.choosing),
        F.data.startswith("qedit:rate:"),
    )
    dp.callback_query.register(quick_edit_cb, F.data.startswith("qedit:"))

    dp.callback_query.register(rate_pick, F.data.startswith("rate:"))
    dp.callback_query.register(summary_skip, F.data == "skip:summary")

    dp.callback_query.register(photos_done, F.data == "photos:done")
    dp.callback_query.register(photos_skip, F.data == "skip:photos")
    dp.callback_query.register(show_pics, F.data.startswith("pics:"))

    # поиск / меню / пагинация
    dp.callback_query.register(s_last, F.data == "s_last")
    dp.callback_query.register(s_name, F.data == "s_name")
    dp.callback_query.register(s_cat, F.data == "s_cat")
    dp.callback_query.register(s_year, F.data == "s_year")
    dp.callback_query.register(s_rating, F.data == "s_rating")

    dp.callback_query.register(rating_filter_pick, F.data.startswith("frate:"))
    dp.callback_query.register(more_last, F.data.startswith("more:last:"))
    dp.callback_query.register(more_name, F.data.startswith("more:name:"))
    dp.callback_query.register(more_cat, F.data.startswith("more:cat:"))
    dp.callback_query.register(more_year, F.data.startswith("more:year:"))
    dp.callback_query.register(more_rating, F.data.startswith("more:rating:"))

    # редактирование tasting
    dp.callback_query.register(edit_field_select, F.data.startswith("efld:"))
    dp.callback_query.register(edit_category_pick, F.data.startswith("ecat:"))
    dp.callback_query.register(edit_rating_pick, F.data.startswith("erat:"))
    dp.callback_query.register(edit_cb, F.data.startswith("edit:"))

    # карточка
    dp.callback_query.register(open_card, F.data.startswith("open:"))
    dp.callback_query.register(del_cb, F.data.startswith("del:"))
    dp.callback_query.register(del_ok_cb, F.data.startswith("delok:"))
    dp.callback_query.register(del_no_cb, F.data.startswith("delno:"))


async def set_bot_commands(bot: Bot):
    commands = [
        BotCommand(command="start", description="Главное меню"),
        BotCommand(command="help", description="Помощь"),
        BotCommand(command="new", description="Новая дегустация"),
        BotCommand(command="quick", description="Быстрая заметка"),
        BotCommand(command="notes", description="Мои дегустации"),
        BotCommand(command="find", description="Поиск"),
        BotCommand(command="tz", description="Часовой пояс (UTC-сдвиг)"),
        BotCommand(command="stats", description="Моя статистика"),
        BotCommand(command="cancel", description="Отмена текущего действия"),
    ]
    await bot.set_my_commands(commands)


# ---------------- MAIN ----------------

async def main():
    db_url = get_db_url()
    try:
        safe = db_url.render_as_string(hide_password=True)
    except AttributeError:
        safe = str(db_url)
    print(f"[DB] Using: {safe}")
    engine = create_sa_engine(db_url)
    startup_ping(engine)

    try:
        import uvloop  # type: ignore

        asyncio.set_event_loop_policy(uvloop.EventLoopPolicy())
    except Exception:
        pass

    bot = Bot(get_bot_token())

    try:
        await bot.delete_webhook(drop_pending_updates=True)
    except Exception:
        pass

    dp = Dispatcher()
    setup_handlers(dp)
    try:
        await set_bot_commands(bot)
    except Exception as e:
        logger.warning("Failed to set bot commands: %s", e)

    logging.info("Start polling")
    await dp.start_polling(
        bot,
        allowed_updates=dp.resolve_used_update_types(),
        polling_timeout=30,
        handle_signals=True,
    )


if __name__ == "__main__":
    asyncio.run(main())

"""Вкусовой профиль сорта — агрегат тегов из дегустаций (quick + full).

Решения зафиксированы в задаче Todoist «Вкусовой профиль сорта» (11.07.2026):
- тег считается один раз на запись (объединение по проливам, дедуп внутри записи);
- агрегация ветвится по entry_mode: у quick aroma_dry = «Аромат», aroma_warmed = «Вкус»;
- белый список тегов + синонимы бот→веб; свободный ввод («Другое: …» из веба,
  голые слова из бота) в профиль не попадает;
- рейтинг = средняя по 10-балльной шкале, записи с rating=0 исключаются.
"""

from collections import Counter
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Infusion, Tasting

# Канонический словарь тегов веб-форм (frontend/lib/constants.ts) + «Мёд» —
# пресет бота без пары в вебе, показывается самостоятельным тегом.
AROMA_TAGS = [
    "Хлебный", "Кондитерский", "Ореховый", "Сухофрукты",
    "Цветочный", "Ягодный", "Фруктовый", "Травянистый",
    "Овощной", "Пряный", "Древесный", "Землистый",
    "Дымный", "Минеральный", "Мёд",
]

EFFECT_TAGS = [
    "Тепло", "Охлаждение", "Расслабление", "Фокус",
    "Бодрость", "Тонус", "Спокойствие", "Сонливость",
]

# Синонимы (нижний регистр → канонический тег): пресеты бота, варианты
# написания и «зонтичные» частные случаи из живых данных. Закрытый список —
# новый свободный ввод сюда не попадает.
_SYNONYMS = {
    # пресеты бота (DESCRIPTORS в app/main.py)
    "сухофрукты": "Сухофрукты",
    "хлебные": "Хлебный",
    "цветы": "Цветочный",
    "орех": "Ореховый",
    "древесный": "Древесный",
    "дымный": "Дымный",
    "ягоды": "Ягодный",
    "фрукты": "Фруктовый",
    "травянистый": "Травянистый",
    "овощные": "Овощной",
    "пряный": "Пряный",
    "землистый": "Землистый",
    "мёд": "Мёд",
    # варианты написания из живых данных
    "пряности": "Пряный",
    "пряные": "Пряный",
    "орехи": "Ореховый",
    "минеральность": "Минеральный",
    "минералы": "Минеральный",
    "мед": "Мёд",
    "древесина": "Древесный",
    "древесность": "Древесный",
    # «зонтичные» — частные случаи существующих тегов
    "печенье": "Кондитерский",
    "бисквит": "Кондитерский",
    "карамель": "Кондитерский",
    "сладкая выпечка": "Кондитерский",
    "груша": "Фруктовый",
    "яблоко": "Фруктовый",
    "абрикос": "Фруктовый",
    "персик": "Фруктовый",
    "корица": "Пряный",
    "сухая древесина": "Древесный",
}

_AROMA_LOOKUP = {t.lower(): t for t in AROMA_TAGS} | _SYNONYMS
_EFFECT_LOOKUP = {t.lower(): t for t in EFFECT_TAGS}

TOP_N = 8


def _parse_tags(csv: Optional[str], lookup: dict) -> set:
    """CSV-строка поля → набор канонических тегов.

    Хвост «Другое: …» отрезается целиком: по конвенции веб-форм он всегда
    последний, и запятые после него — часть свободного текста. Токены вида
    «Прогретый лист: цветы» (артефакт старого формата бота) чистятся от
    префикса до двоеточия.
    """
    if not csv or not csv.strip():
        return set()
    tags = set()
    for token in csv.split(","):
        token = token.strip()
        if token.startswith("Другое:"):
            break
        if ":" in token:
            token = token.rsplit(":", 1)[1].strip()
        canonical = lookup.get(token.lower())
        if canonical:
            tags.add(canonical)
    return tags


def _top(counter: Counter) -> List[dict]:
    ordered = sorted(counter.items(), key=lambda kv: (-kv[1], kv[0]))[:TOP_N]
    return [{"tag": tag, "count": count} for tag, count in ordered]


def build_flavor_profile(db: Session, user_id: int, tea_item_id: int) -> dict:
    tastings = db.execute(
        select(Tasting).where(
            Tasting.user_id == user_id, Tasting.tea_item_id == tea_item_id
        )
    ).scalars().all()

    full_ids = [t.id for t in tastings if t.entry_mode != "quick"]
    taste_by_tasting: dict[int, set] = {}
    if full_ids:
        infusions = db.execute(
            select(Infusion.tasting_id, Infusion.taste).where(
                Infusion.tasting_id.in_(full_ids)
            )
        ).all()
        for tasting_id, taste_csv in infusions:
            taste_by_tasting.setdefault(tasting_id, set()).update(
                _parse_tags(taste_csv, _AROMA_LOOKUP)
            )

    aroma, taste, effects = Counter(), Counter(), Counter()
    records_used = 0
    ratings: List[int] = []

    for t in tastings:
        if t.entry_mode == "quick":
            # исторический маппинг quick-полей: aroma_dry = «Аромат», aroma_warmed = «Вкус»
            record_aroma = _parse_tags(t.aroma_dry, _AROMA_LOOKUP)
            record_taste = _parse_tags(t.aroma_warmed, _AROMA_LOOKUP)
        else:
            record_aroma = _parse_tags(t.aroma_dry, _AROMA_LOOKUP) | _parse_tags(
                t.aroma_warmed, _AROMA_LOOKUP
            )
            record_taste = taste_by_tasting.get(t.id, set())
        record_effects = _parse_tags(t.effects_csv, _EFFECT_LOOKUP)

        for tag in record_aroma:
            aroma[tag] += 1
        for tag in record_taste:
            taste[tag] += 1
        for tag in record_effects:
            effects[tag] += 1

        if record_aroma or record_taste or record_effects or t.rating > 0:
            records_used += 1
        if t.rating > 0:
            ratings.append(t.rating)

    avg_rating = round(sum(ratings) / len(ratings), 1) if ratings else None

    return {
        "aroma": _top(aroma),
        "taste": _top(taste),
        "effects": _top(effects),
        "records_used": records_used,
        "avg_rating": avg_rating,
    }

from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Iterable, List


def parse_int(
    raw: str,
    *,
    min_value: int,
    max_value: int,
    error_message: str,
) -> int:
    text = (raw or "").strip()
    try:
        value = int(text)
    except (TypeError, ValueError):
        raise ValueError(error_message) from None

    if value < min_value or value > max_value:
        raise ValueError(error_message)

    return value


def parse_float(
    raw: str,
    *,
    min_value: float,
    max_value: float,
    error_message: str,
    precision: int = 1,
) -> float:
    text = (raw or "").strip().replace(",", ".")
    if not text:
        raise ValueError(error_message)

    try:
        value = Decimal(text)
    except (InvalidOperation, ValueError):
        raise ValueError(error_message) from None

    quant = Decimal(10) ** -precision
    value = value.quantize(quant, rounding=ROUND_HALF_UP)

    if value < Decimal(str(min_value)) or value > Decimal(str(max_value)):
        raise ValueError(error_message)

    return float(value)


def parse_infusions_list(
    raw: str,
    *,
    min_value: int = 1,
    max_value: int = 600,
    max_count: int = 30,
    error_message: str,
) -> List[int]:
    text = (raw or "").strip()
    if not text:
        raise ValueError(error_message)

    parts: Iterable[str] = re.split(r"[\s,;]+", text)
    values: List[int] = []
    for part in parts:
        if not part:
            continue
        if not part.isdigit():
            raise ValueError(error_message)
        value = int(part)
        if value < min_value or value > max_value:
            raise ValueError(error_message)
        values.append(value)

    if not values or len(values) > max_count:
        raise ValueError(error_message)

    return values

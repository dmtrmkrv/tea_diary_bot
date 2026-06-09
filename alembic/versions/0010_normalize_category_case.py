"""Нормализация регистра категорий чая в tastings и tea_items.

Приводим разнобой к каноническим формам:
- 'Шу Пуэр'  → 'Шу пуэр'
- 'Шен Пуэр' → 'Шен пуэр'
- 'Хэй Ча'   → 'Хэй ча'
- 'Желтый'   → 'Жёлтый'
- 'Зеленый'  → 'Зелёный'

Это data migration — схема не меняется, только значения. Downgrade no-op,
потому что обратное отображение неоднозначно (мы не знаем какие записи
изначально были с какими вариантами регистра).
"""

from alembic import op


revision = "0010_normalize_category_case"
down_revision = "0009_teaware_id_in_tastings"
branch_labels = None
depends_on = None


REPLACEMENTS = [
    ("Шу Пуэр", "Шу пуэр"),
    ("Шен Пуэр", "Шен пуэр"),
    ("Хэй Ча", "Хэй ча"),
    ("Желтый", "Жёлтый"),
    ("Зеленый", "Зелёный"),
]


def upgrade() -> None:
    for table in ("tastings", "tea_items"):
        for old, new in REPLACEMENTS:
            op.execute(
                f"UPDATE {table} SET category = '{new}' WHERE category = '{old}'"
            )


def downgrade() -> None:
    # No-op: обратное преобразование неоднозначно. Если когда-то понадобится
    # откат — нужно решать вручную исходя из ситуации.
    pass

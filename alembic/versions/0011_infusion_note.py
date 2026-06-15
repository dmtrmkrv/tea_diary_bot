"""Добавляет поле note (заметка по проливу) в infusions.

Поле собиралось в веб-форме создания дегустации, но не имело колонки в БД —
терялось при сохранении. Добавляем nullable Text-колонку.
"""

from alembic import op
import sqlalchemy as sa


revision = "0011_infusion_note"
down_revision = "0010_normalize_category_case"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("infusions", sa.Column("note", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("infusions", "note")

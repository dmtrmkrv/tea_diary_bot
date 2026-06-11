"""Учёт остатков чая: amount_g в tea_items.

NULL = «остаток не отслеживается» (поле опционально), 0 = «закончился».
При создании дегустации с tea_item_id и grams остаток списывается
автоматически (clamp до 0) — см. services/tastings.create_tasting.
"""

from alembic import op
import sqlalchemy as sa


revision = "0013_tea_item_amount"
down_revision = "0012_teaware_region_suitable"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tea_items", sa.Column("amount_g", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("tea_items", "amount_g")

"""deducted_g в tastings — фактически списанный остаток сорта.

Записывается при создании дегустации (с учётом clamp до 0: если остатка
было меньше веса — записывается сколько реально списалось). При удалении
дегустации возвращается к amount_g сорта ровно это значение.
NULL — списания не было (нет привязки/веса/учёта или старая запись).
"""

from alembic import op
import sqlalchemy as sa


revision = "0014_tasting_deducted"
down_revision = "0013_tea_item_amount"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tastings", sa.Column("deducted_g", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("tastings", "deducted_g")

"""Расширение Teaware для раздела «Посуда»: регион и пригодность для сортов.

- region: регион производства (Исин, Цзяньшуй... или свободный текст при «Другое»)
- suitable_csv: CSV категорий чая, для которых подходит посуда
  (по аналогии с effects_csv/scenarios_csv в tastings)
"""

from alembic import op
import sqlalchemy as sa


revision = "0012_teaware_region_suitable"
down_revision = "0011_infusion_note"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("teaware", sa.Column("region", sa.String(length=120), nullable=True))
    op.add_column("teaware", sa.Column("suitable_csv", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("teaware", "suitable_csv")
    op.drop_column("teaware", "region")

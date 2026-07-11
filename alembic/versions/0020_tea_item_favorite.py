"""Избранные сорта: tea_items.is_favorite (сердечко в коллекции и шторке).

NOT NULL с server_default false — существующие строки получают «не избранное».
"""

from alembic import op
import sqlalchemy as sa


revision = "0020_tea_item_favorite"
down_revision = "0019_photo_thumbs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tea_items",
        sa.Column(
            "is_favorite", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
    )


def downgrade() -> None:
    op.drop_column("tea_items", "is_favorite")

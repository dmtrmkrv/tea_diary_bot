"""Ключи миниатюр (WEBP для списков): photos.thumb_object_key +
cover_thumb_object_key у сортов и посуды.

Все поля nullable: у старых фото миниатюр нет до бэкфилла, списки
в этом случае отдают полноразмерный файл (фолбэк).
"""

from alembic import op
import sqlalchemy as sa


revision = "0019_photo_thumbs"
down_revision = "0018_password_resets"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("photos", sa.Column("thumb_object_key", sa.Text(), nullable=True))
    op.add_column(
        "tea_items", sa.Column("cover_thumb_object_key", sa.Text(), nullable=True)
    )
    op.add_column(
        "teaware", sa.Column("cover_thumb_object_key", sa.Text(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("teaware", "cover_thumb_object_key")
    op.drop_column("tea_items", "cover_thumb_object_key")
    op.drop_column("photos", "thumb_object_key")

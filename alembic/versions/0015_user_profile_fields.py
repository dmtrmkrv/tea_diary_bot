"""Поля профиля пользователя: first_name и photo_url из Telegram.

Обновляются при каждом логине через Telegram-виджет (/auth/telegram).
Для пользователей, входящих по коду из бота (/auth/code), могут оставаться
NULL — фронт показывает fallback-аватар и username.
"""

from alembic import op
import sqlalchemy as sa


revision = "0015_user_profile_fields"
down_revision = "0014_tasting_deducted"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("first_name", sa.String(length=64), nullable=True))
    op.add_column("users", sa.Column("photo_url", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "photo_url")
    op.drop_column("users", "first_name")

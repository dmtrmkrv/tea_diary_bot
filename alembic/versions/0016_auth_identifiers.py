"""Развязка users.id от telegram_id + идентификаторы входа (Arch 1).

Аддитивно, данные НЕ двигаем:
- колонки telegram_id / email / password_hash / yandex_id / consented_at;
- бэкфилл telegram_id = id (существующие строки = telegram-юзеры);
- уникальные индексы по идентификаторам;
- (PG) sequence users_web_id_seq со стартом выше telegram-id диапазона —
  новые web-юзеры получают неконфликтующие id (сервис проставляет nextval);
  бот продолжает писать id=telegram_id. id-колонку не трогаем.
- (PG) CHECK: хотя бы один идентификатор (на SQLite — на app-уровне).

См. docs/auth-arch1-plan.md.
"""

from alembic import op
import sqlalchemy as sa


revision = "0016_auth_identifiers"
down_revision = "0015_user_profile_fields"
branch_labels = None
depends_on = None


# Старт sequence для web-юзеров: на 2 порядка выше любого telegram_id (макс ~7.8e9).
WEB_ID_START = 1_000_000_000_000  # 10^12


def upgrade() -> None:
    op.add_column("users", sa.Column("telegram_id", sa.BigInteger(), nullable=True))
    op.add_column("users", sa.Column("email", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("password_hash", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("yandex_id", sa.String(length=64), nullable=True))
    op.add_column("users", sa.Column("consented_at", sa.DateTime(), nullable=True))

    # Существующие строки — telegram-юзеры: telegram_id = id.
    op.execute("UPDATE users SET telegram_id = id WHERE telegram_id IS NULL")

    op.create_index("ix_users_telegram_id", "users", ["telegram_id"], unique=True)
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_yandex_id", "users", ["yandex_id"], unique=True)

    if op.get_bind().dialect.name == "postgresql":
        op.execute(
            f"CREATE SEQUENCE IF NOT EXISTS users_web_id_seq START WITH {WEB_ID_START}"
        )
        op.execute(
            "ALTER TABLE users ADD CONSTRAINT ck_users_identifier "
            "CHECK (email IS NOT NULL OR telegram_id IS NOT NULL OR yandex_id IS NOT NULL)"
        )


def downgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS ck_users_identifier")
        op.execute("DROP SEQUENCE IF EXISTS users_web_id_seq")

    op.drop_index("ix_users_yandex_id", table_name="users")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_telegram_id", table_name="users")

    op.drop_column("users", "consented_at")
    op.drop_column("users", "yandex_id")
    op.drop_column("users", "password_hash")
    op.drop_column("users", "email")
    op.drop_column("users", "telegram_id")

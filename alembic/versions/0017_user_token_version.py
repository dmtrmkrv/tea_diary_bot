"""users.token_version — отзыв всех сессий пользователя.

Версия токенов юзера: пишется в JWT (claim tv) и сверяется при каждом
запросе. Бамп версии (при смене пароля) мгновенно отзывает все выданные
ранее токены. Дефолт 0 = действующие JWT без claim tv остаются валидными,
сессии пользователей не слетают.

См. docs/auth-arch1-plan.md.
"""

from alembic import op
import sqlalchemy as sa


revision = "0017_user_token_version"
down_revision = "0016_auth_identifiers"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("token_version", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("users", "token_version")

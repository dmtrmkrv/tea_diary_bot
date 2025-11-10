"""telegram id bigint"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector


revision = "0002_telegram_id_bigint"
down_revision = "0001"
branch_labels = None
depends_on = None


USERS = "users"
TASTINGS = "tastings"


def _drop_user_fk(bind, table):
    insp = Inspector.from_engine(bind)
    fks = [fk for fk in insp.get_foreign_keys(table) if fk.get("referred_table") == USERS]
    for fk in fks:
        name = fk.get("name")
        if name:
            op.drop_constraint(name, table, type_="foreignkey")


def _create_user_fk(table, col="user_id"):
    op.create_foreign_key(
        constraint_name=f"fk_{table}_{col}_{USERS}_id",
        source_table=table,
        referent_table=USERS,
        local_cols=[col],
        remote_cols=["id"],
        ondelete="CASCADE",
    )


def upgrade():
    bind = op.get_bind()

    _drop_user_fk(bind, TASTINGS)

    op.alter_column(
        USERS,
        "id",
        existing_type=sa.Integer(),
        type_=sa.BigInteger(),
        existing_nullable=False,
    )

    op.alter_column(
        TASTINGS,
        "user_id",
        existing_type=sa.Integer(),
        type_=sa.BigInteger(),
        existing_nullable=False,
    )

    _create_user_fk(TASTINGS, "user_id")


def downgrade():
    bind = op.get_bind()

    _drop_user_fk(bind, TASTINGS)

    op.alter_column(
        TASTINGS,
        "user_id",
        existing_type=sa.BigInteger(),
        type_=sa.Integer(),
        existing_nullable=False,
    )

    op.alter_column(
        USERS,
        "id",
        existing_type=sa.BigInteger(),
        type_=sa.Integer(),
        existing_nullable=False,
    )

    _create_user_fk(TASTINGS, "user_id")

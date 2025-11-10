"""Drop seq default and add username"""

from alembic import op
import sqlalchemy as sa


revision = "0003_seq_no_idx_and_username"
down_revision = "0002_telegram_id_bigint"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("username", sa.String(length=32), nullable=True))

    op.alter_column(
        "tastings",
        "seq_no",
        existing_type=sa.Integer(),
        server_default=None,
        existing_nullable=False,
        existing_server_default=sa.text("0"),
    )
    op.drop_constraint("uq_tastings_user_seq_no", "tastings", type_="unique")
    op.create_index(
        "ux_tastings_user_seq",
        "tastings",
        ["user_id", "seq_no"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ux_tastings_user_seq", table_name="tastings")
    op.create_unique_constraint(
        "uq_tastings_user_seq_no",
        "tastings",
        ["user_id", "seq_no"],
    )
    op.alter_column(
        "tastings",
        "seq_no",
        existing_type=sa.Integer(),
        server_default=sa.text("0"),
        existing_nullable=False,
    )
    op.drop_column("users", "username")

from alembic import op
import sqlalchemy as sa


revision = "0006_tastings_entry_mode"
down_revision = "0005_expand_text_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tastings",
        sa.Column(
            "entry_mode",
            sa.String(length=16),
            nullable=False,
            server_default=sa.text("'full'"),
        ),
    )


def downgrade() -> None:
    op.drop_column("tastings", "entry_mode")

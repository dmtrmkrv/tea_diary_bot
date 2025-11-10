"""init_schema"""

from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("tz_offset_min", sa.Integer(), nullable=False, server_default="0"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "tastings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("year", sa.Integer(), nullable=True),
        sa.Column("region", sa.String(length=120), nullable=True),
        sa.Column("category", sa.String(length=60), nullable=False),
        sa.Column("grams", sa.Float(), nullable=True),
        sa.Column("temp_c", sa.Integer(), nullable=True),
        sa.Column("tasted_at", sa.String(length=8), nullable=True),
        sa.Column("gear", sa.String(length=200), nullable=True),
        sa.Column("aroma_dry", sa.String(), nullable=True),
        sa.Column("aroma_warmed", sa.String(), nullable=True),
        sa.Column("aroma_after", sa.String(), nullable=True),
        sa.Column("effects_csv", sa.String(length=300), nullable=True),
        sa.Column("scenarios_csv", sa.String(length=200), nullable=True),
        sa.Column("rating", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("summary", sa.String(), nullable=True),
        sa.Column("seq_no", sa.Integer(), nullable=False, server_default="0"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "seq_no", name="uq_tastings_user_seq_no"),
    )
    op.create_table(
        "infusions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tasting_id", sa.Integer(), nullable=False),
        sa.Column("n", sa.Integer(), nullable=False),
        sa.Column("seconds", sa.Integer(), nullable=True),
        sa.Column("liquor_color", sa.String(length=120), nullable=True),
        sa.Column("taste", sa.String(), nullable=True),
        sa.Column("special_notes", sa.String(), nullable=True),
        sa.Column("body", sa.String(length=40), nullable=True),
        sa.Column("aftertaste", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["tasting_id"], ["tastings.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "photos",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tasting_id", sa.Integer(), nullable=False),
        sa.Column("file_id", sa.String(length=255), nullable=False),
        sa.ForeignKeyConstraint(["tasting_id"], ["tastings.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tastings_user_id", "tastings", ["user_id"], unique=False)
    op.create_index("ix_tastings_user_category", "tastings", ["user_id", "category"], unique=False)
    op.create_index("ix_tastings_user_year", "tastings", ["user_id", "year"], unique=False)
    op.create_index("ix_tastings_user_rating", "tastings", ["user_id", "rating"], unique=False)
    op.create_index(
        "ix_tastings_user_id_desc",
        "tastings",
        ["user_id", sa.text("id DESC")],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_tastings_user_id_desc", table_name="tastings")
    op.drop_index("ix_tastings_user_rating", table_name="tastings")
    op.drop_index("ix_tastings_user_year", table_name="tastings")
    op.drop_index("ix_tastings_user_category", table_name="tastings")
    op.drop_index("ix_tastings_user_id", table_name="tastings")
    op.drop_table("photos")
    op.drop_table("infusions")
    op.drop_table("tastings")
    op.drop_table("users")

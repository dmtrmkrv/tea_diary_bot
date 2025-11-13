"""expand text fields for tastings and infusions"""

from alembic import op
import sqlalchemy as sa


revision = "0005_expand_text_fields"
down_revision = "0004_photos_s3_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "infusions",
        "liquor_color",
        existing_type=sa.VARCHAR(length=120),
        type_=sa.Text(),
        existing_nullable=True,
    )
    op.alter_column(
        "infusions",
        "taste",
        existing_type=sa.TEXT(),
        type_=sa.Text(),
        existing_nullable=True,
    )
    op.alter_column(
        "infusions",
        "special_notes",
        existing_type=sa.TEXT(),
        type_=sa.Text(),
        existing_nullable=True,
    )
    op.alter_column(
        "infusions",
        "body",
        existing_type=sa.VARCHAR(length=40),
        type_=sa.Text(),
        existing_nullable=True,
    )
    op.alter_column(
        "infusions",
        "aftertaste",
        existing_type=sa.TEXT(),
        type_=sa.Text(),
        existing_nullable=True,
    )

    op.alter_column(
        "tastings",
        "gear",
        existing_type=sa.VARCHAR(length=200),
        type_=sa.Text(),
        existing_nullable=True,
    )
    op.alter_column(
        "tastings",
        "aroma_dry",
        existing_type=sa.TEXT(),
        type_=sa.Text(),
        existing_nullable=True,
    )
    op.alter_column(
        "tastings",
        "aroma_warmed",
        existing_type=sa.TEXT(),
        type_=sa.Text(),
        existing_nullable=True,
    )
    op.alter_column(
        "tastings",
        "aroma_after",
        existing_type=sa.TEXT(),
        type_=sa.Text(),
        existing_nullable=True,
    )
    op.alter_column(
        "tastings",
        "effects_csv",
        existing_type=sa.VARCHAR(length=300),
        type_=sa.Text(),
        existing_nullable=True,
    )
    op.alter_column(
        "tastings",
        "scenarios_csv",
        existing_type=sa.VARCHAR(length=200),
        type_=sa.Text(),
        existing_nullable=True,
    )
    op.alter_column(
        "tastings",
        "summary",
        existing_type=sa.TEXT(),
        type_=sa.Text(),
        existing_nullable=True,
    )


def downgrade() -> None:
    # При откате будут возвращены исходные ограничения по длине колонок.
    # Если в базе уже присутствуют длинные строки, они будут усечены с помощью
    # выражения LEFT(...), либо откат завершится ошибкой приведения типов.
    op.alter_column(
        "tastings",
        "summary",
        existing_type=sa.Text(),
        type_=sa.TEXT(),
        existing_nullable=True,
    )
    op.alter_column(
        "tastings",
        "scenarios_csv",
        existing_type=sa.Text(),
        type_=sa.VARCHAR(length=200),
        existing_nullable=True,
        postgresql_using="left(scenarios_csv, 200)",
    )
    op.alter_column(
        "tastings",
        "effects_csv",
        existing_type=sa.Text(),
        type_=sa.VARCHAR(length=300),
        existing_nullable=True,
        postgresql_using="left(effects_csv, 300)",
    )
    op.alter_column(
        "tastings",
        "aroma_after",
        existing_type=sa.Text(),
        type_=sa.TEXT(),
        existing_nullable=True,
    )
    op.alter_column(
        "tastings",
        "aroma_warmed",
        existing_type=sa.Text(),
        type_=sa.TEXT(),
        existing_nullable=True,
    )
    op.alter_column(
        "tastings",
        "aroma_dry",
        existing_type=sa.Text(),
        type_=sa.TEXT(),
        existing_nullable=True,
    )
    op.alter_column(
        "tastings",
        "gear",
        existing_type=sa.Text(),
        type_=sa.VARCHAR(length=200),
        existing_nullable=True,
        postgresql_using="gear::varchar(200)",
    )

    op.alter_column(
        "infusions",
        "aftertaste",
        existing_type=sa.Text(),
        type_=sa.TEXT(),
        existing_nullable=True,
    )
    op.alter_column(
        "infusions",
        "body",
        existing_type=sa.Text(),
        type_=sa.VARCHAR(length=40),
        existing_nullable=True,
        postgresql_using="left(body, 40)",
    )
    op.alter_column(
        "infusions",
        "special_notes",
        existing_type=sa.Text(),
        type_=sa.TEXT(),
        existing_nullable=True,
    )
    op.alter_column(
        "infusions",
        "taste",
        existing_type=sa.Text(),
        type_=sa.TEXT(),
        existing_nullable=True,
    )
    op.alter_column(
        "infusions",
        "liquor_color",
        existing_type=sa.Text(),
        type_=sa.VARCHAR(length=120),
        existing_nullable=True,
        postgresql_using="left(liquor_color, 120)",
    )

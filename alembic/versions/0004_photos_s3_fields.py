"""photos_s3_fields"""

from alembic import op
import sqlalchemy as sa


revision = "0004_photos_s3_fields"
down_revision = "0003_seq_no_idx_and_username"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "photos",
        sa.Column(
            "storage_backend",
            sa.String(length=16),
            server_default="local",
            nullable=False,
        ),
    )
    op.add_column("photos", sa.Column("object_key", sa.Text(), nullable=True))
    op.add_column(
        "photos", sa.Column("content_type", sa.String(length=64), nullable=True)
    )
    op.add_column("photos", sa.Column("size_bytes", sa.Integer(), nullable=True))
    op.add_column("photos", sa.Column("telegram_file_id", sa.Text(), nullable=True))
    op.add_column(
        "photos", sa.Column("telegram_file_unique_id", sa.Text(), nullable=True)
    )
    op.create_index(
        "ix_photos_object_key",
        "photos",
        ["object_key"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_photos_object_key", table_name="photos")
    op.drop_column("photos", "telegram_file_unique_id")
    op.drop_column("photos", "telegram_file_id")
    op.drop_column("photos", "size_bytes")
    op.drop_column("photos", "content_type")
    op.drop_column("photos", "object_key")
    op.drop_column("photos", "storage_backend")

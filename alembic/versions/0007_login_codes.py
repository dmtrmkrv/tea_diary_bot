"""login_codes table

Revision ID: 0007
Revises: 0006
Create Date: 2026-04-13
"""
from alembic import op
import sqlalchemy as sa

revision = '0007'
down_revision = '0006_tastings_entry_mode'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'login_codes',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('code', sa.String(8), nullable=False, unique=True, index=True),
        sa.Column('telegram_id', sa.BigInteger(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('used', sa.Boolean(), default=False, nullable=False),
    )


def downgrade() -> None:
    op.drop_table('login_codes')

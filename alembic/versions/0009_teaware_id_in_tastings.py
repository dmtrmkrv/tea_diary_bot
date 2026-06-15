"""teaware_id in tastings

Revision ID: 0009
Revises: 0008
Create Date: 2026-05-02
"""
from alembic import op
import sqlalchemy as sa

revision = '0009'
down_revision = '0008'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'tastings',
        sa.Column(
            'teaware_id',
            sa.Integer(),
            sa.ForeignKey('teaware.id', ondelete='SET NULL'),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column('tastings', 'teaware_id')

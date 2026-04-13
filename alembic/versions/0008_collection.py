"""collection tables

Revision ID: 0008
Revises: 0007
Create Date: 2026-04-14
"""
from alembic import op
import sqlalchemy as sa

revision = '0008'
down_revision = '0007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'tea_items',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.BigInteger(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('category', sa.String(60), nullable=True),
        sa.Column('year', sa.Integer(), nullable=True),
        sa.Column('region', sa.String(120), nullable=True),
        sa.Column('vendor', sa.String(200), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('cover_object_key', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_tea_items_user_id', 'tea_items', ['user_id'])

    op.create_table(
        'teaware',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.BigInteger(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('type', sa.String(60), nullable=True),
        sa.Column('volume_ml', sa.Integer(), nullable=True),
        sa.Column('material', sa.String(100), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('cover_object_key', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_teaware_user_id', 'teaware', ['user_id'])

    op.add_column('tastings', sa.Column('tea_item_id', sa.Integer(), sa.ForeignKey('tea_items.id', ondelete='SET NULL'), nullable=True))


def downgrade() -> None:
    op.drop_column('tastings', 'tea_item_id')
    op.drop_index('ix_teaware_user_id', 'teaware')
    op.drop_table('teaware')
    op.drop_index('ix_tea_items_user_id', 'tea_items')
    op.drop_table('tea_items')

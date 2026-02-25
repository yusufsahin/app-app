"""Add status, settings, metadata to projects.

Revision ID: 010
Revises: 009
Create Date: 2026-02-23

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("status", sa.String(50), nullable=True),
    )
    op.add_column(
        "projects",
        sa.Column("settings", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column(
        "projects",
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("projects", "metadata")
    op.drop_column("projects", "settings")
    op.drop_column("projects", "status")

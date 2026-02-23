"""Add custom_fields JSONB to artifacts.

Revision ID: 008
Revises: 007
Create Date: 2026-02-23

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "artifacts",
        sa.Column("custom_fields", JSONB, nullable=True, server_default="{}"),
    )


def downgrade() -> None:
    op.drop_column("artifacts", "custom_fields")

"""Add description, type, configuration to process_templates.

Revision ID: 009
Revises: 008
Create Date: 2026-02-23

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "process_templates",
        sa.Column("description", sa.Text(), nullable=True),
    )
    op.add_column(
        "process_templates",
        sa.Column("type", sa.String(50), nullable=True),
    )
    op.add_column(
        "process_templates",
        sa.Column("configuration", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("process_templates", "configuration")
    op.drop_column("process_templates", "type")
    op.drop_column("process_templates", "description")

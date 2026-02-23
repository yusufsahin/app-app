"""Add process_template_version_id to projects.

Revision ID: 004
Revises: 003
Create Date: 2026-02-23

"""
from alembic import op
import sqlalchemy as sa

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("process_template_version_id", sa.Uuid(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("projects", "process_template_version_id")

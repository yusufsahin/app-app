"""Widen process_template_versions.version to 32 chars (custom-YYYYMMDDHHMMSS is 21).

Revision ID: 030
Revises: 029
Create Date: 2026-02-27

"""
from alembic import op
import sqlalchemy as sa

revision = "030"
down_revision = "029"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "process_template_versions",
        "version",
        existing_type=sa.String(20),
        type_=sa.String(32),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "process_template_versions",
        "version",
        existing_type=sa.String(32),
        type_=sa.String(20),
        existing_nullable=False,
    )

"""Add artifact_seq to projects for artifact_key generation.

Revision ID: 013
Revises: 012
Create Date: 2026-02-23

"""
from alembic import op
import sqlalchemy as sa

revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("artifact_seq", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("projects", "artifact_seq")

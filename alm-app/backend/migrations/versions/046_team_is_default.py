"""Add teams.is_default (one default team per project; ADO-style).

Revision ID: 046
Revises: 045
Create Date: 2026-04-04
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "046"
down_revision = "045"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "teams",
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.execute(
        """
        UPDATE teams AS t
        SET is_default = true
        FROM (
            SELECT DISTINCT ON (project_id) id
            FROM teams
            ORDER BY project_id, created_at ASC NULLS LAST, id ASC
        ) AS first_per_project
        WHERE t.id = first_per_project.id
        """
    )
    op.alter_column("teams", "is_default", server_default=None)


def downgrade() -> None:
    op.drop_column("teams", "is_default")

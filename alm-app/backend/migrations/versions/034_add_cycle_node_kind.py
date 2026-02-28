"""Add kind (release|iteration) to cycle_nodes for SDLC release/iteration hierarchy.

Revision ID: 034
Revises: 033
Create Date: 2026-02-28

- kind: 'release' for top-level nodes, 'iteration' for sprints. Default 'iteration' for existing rows.
"""
from alembic import op
import sqlalchemy as sa

revision = "034"
down_revision = "033"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "cycle_nodes",
        sa.Column("kind", sa.String(20), nullable=False, server_default="iteration"),
    )


def downgrade() -> None:
    op.drop_column("cycle_nodes", "kind")

"""S4b: stale_traceability flags on artifacts (linked tests when upstream planning changes).

Revision ID: 053
Revises: 052
Create Date: 2026-04-07
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "053"
down_revision = "052"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "artifacts",
        sa.Column("stale_traceability", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column("artifacts", sa.Column("stale_traceability_reason", sa.String(length=512), nullable=True))
    op.add_column(
        "artifacts",
        sa.Column("stale_traceability_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_artifacts_stale_traceability",
        "artifacts",
        ["project_id", "stale_traceability"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_artifacts_stale_traceability", table_name="artifacts")
    op.drop_column("artifacts", "stale_traceability_at")
    op.drop_column("artifacts", "stale_traceability_reason")
    op.drop_column("artifacts", "stale_traceability")

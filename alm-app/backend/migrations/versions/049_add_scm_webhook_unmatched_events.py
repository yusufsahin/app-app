"""Add scm_webhook_unmatched_events for triage of webhook no-match cases.

Revision ID: 049
Revises: 048
Create Date: 2026-04-06
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "049"
down_revision = "048"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "scm_webhook_unmatched_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("kind", sa.String(length=64), nullable=False),
        sa.Column("context", JSONB, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_scm_webhook_unmatched_events_project_id",
        "scm_webhook_unmatched_events",
        ["project_id"],
    )
    op.create_index(
        "ix_scm_webhook_unmatched_events_created_at",
        "scm_webhook_unmatched_events",
        ["created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_scm_webhook_unmatched_events_created_at", table_name="scm_webhook_unmatched_events")
    op.drop_index("ix_scm_webhook_unmatched_events_project_id", table_name="scm_webhook_unmatched_events")
    op.drop_table("scm_webhook_unmatched_events")

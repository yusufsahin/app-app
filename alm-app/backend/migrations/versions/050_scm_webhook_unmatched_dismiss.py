"""Add dismiss triage fields to scm_webhook_unmatched_events.

Revision ID: 050
Revises: 049
Create Date: 2026-04-06
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "050"
down_revision = "049"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "scm_webhook_unmatched_events",
        sa.Column("dismissed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "scm_webhook_unmatched_events",
        sa.Column("dismissed_by", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        "fk_scm_webhook_unmatched_events_dismissed_by",
        "scm_webhook_unmatched_events",
        "users",
        ["dismissed_by"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_scm_webhook_unmatched_events_dismissed_by",
        "scm_webhook_unmatched_events",
        type_="foreignkey",
    )
    op.drop_column("scm_webhook_unmatched_events", "dismissed_by")
    op.drop_column("scm_webhook_unmatched_events", "dismissed_at")

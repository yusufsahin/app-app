"""Dedupe table for SCM provider webhook deliveries (enterprise idempotency).

Revision ID: 051
Revises: 050
Create Date: 2026-04-06
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "051"
down_revision = "050"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "scm_webhook_processed_deliveries",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("provider", sa.String(length=16), nullable=False),
        sa.Column("delivery_id", sa.String(length=128), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "project_id",
            "provider",
            "delivery_id",
            name="uq_scm_webhook_processed_deliveries_proj_provider_delivery",
        ),
    )
    op.create_index(
        "ix_scm_webhook_processed_deliveries_project_id",
        "scm_webhook_processed_deliveries",
        ["project_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_scm_webhook_processed_deliveries_project_id", table_name="scm_webhook_processed_deliveries")
    op.drop_table("scm_webhook_processed_deliveries")

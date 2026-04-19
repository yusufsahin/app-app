"""Lease column for multi-instance-safe outbox claiming.

Revision ID: 057
Revises: 056
Create Date: 2026-04-18
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "057"
down_revision = "056"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "domain_event_outbox",
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_domain_event_outbox_locked_until",
        "domain_event_outbox",
        ["locked_until"],
        unique=False,
        postgresql_where=sa.text("locked_until IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_domain_event_outbox_locked_until", table_name="domain_event_outbox")
    op.drop_column("domain_event_outbox", "locked_until")

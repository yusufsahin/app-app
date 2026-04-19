"""Transactional outbox for domain events (dispatch after commit + retry).

Revision ID: 056
Revises: 055
Create Date: 2026-04-18
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "056"
down_revision = "055"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "domain_event_outbox",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("event_type", sa.String(length=512), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("attempts", sa.Integer(), server_default="0", nullable=False),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_domain_event_outbox_created_at",
        "domain_event_outbox",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        "ix_domain_event_outbox_next_attempt",
        "domain_event_outbox",
        ["next_attempt_at"],
        unique=False,
        postgresql_where=sa.text("next_attempt_at IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_domain_event_outbox_next_attempt", table_name="domain_event_outbox")
    op.drop_index("ix_domain_event_outbox_created_at", table_name="domain_event_outbox")
    op.drop_table("domain_event_outbox")

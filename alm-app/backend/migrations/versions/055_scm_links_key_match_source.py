"""Add key_match_source to scm_links (webhook artifact-key resolution slot).

Revision ID: 055
Revises: 054
Create Date: 2026-04-18
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "055"
down_revision = "054"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "scm_links",
        sa.Column("key_match_source", sa.String(length=16), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("scm_links", "key_match_source")

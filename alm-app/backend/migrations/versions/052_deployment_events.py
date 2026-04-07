"""Add deployment_events for S4a deploy traceability (environment + commit/digest).

Revision ID: 052
Revises: 051
Create Date: 2026-04-07
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ARRAY, JSONB

revision = "052"
down_revision = "051"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "deployment_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("environment", sa.String(length=64), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("commit_sha", sa.String(length=64), nullable=True),
        sa.Column("image_digest", sa.String(length=512), nullable=True),
        sa.Column("repo_full_name", sa.String(length=512), nullable=True),
        sa.Column("artifact_keys", ARRAY(sa.String(length=128)), nullable=True),
        sa.Column("release_label", sa.String(length=256), nullable=True),
        sa.Column("build_id", sa.String(length=256), nullable=True),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("raw_context", JSONB(), nullable=True),
        sa.Column("idempotency_key", sa.String(length=128), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_deployment_events_project_env_occurred",
        "deployment_events",
        ["project_id", "environment", "occurred_at"],
        unique=False,
    )
    op.create_index(
        "uq_deployment_events_project_idempotency_key",
        "deployment_events",
        ["project_id", "idempotency_key"],
        unique=True,
        postgresql_where=sa.text("idempotency_key IS NOT NULL"),
    )
    op.create_index(
        "uq_deployment_events_project_env_build",
        "deployment_events",
        ["project_id", "environment", "build_id"],
        unique=True,
        postgresql_where=sa.text("build_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_deployment_events_project_env_build", table_name="deployment_events")
    op.drop_index("uq_deployment_events_project_idempotency_key", table_name="deployment_events")
    op.drop_index("ix_deployment_events_project_env_occurred", table_name="deployment_events")
    op.drop_table("deployment_events")

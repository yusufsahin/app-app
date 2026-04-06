"""Add scm_links for artifact Git PR/commit traceability.

Revision ID: 048
Revises: 047
Create Date: 2026-04-06
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "048"
down_revision = "047"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "scm_links",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("artifact_id", sa.Uuid(), nullable=False),
        sa.Column("task_id", sa.Uuid(), nullable=True),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("repo_full_name", sa.String(length=512), nullable=False),
        sa.Column("ref", sa.String(length=255), nullable=True),
        sa.Column("commit_sha", sa.String(length=64), nullable=True),
        sa.Column("pull_request_number", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(length=500), nullable=True),
        sa.Column("web_url", sa.Text(), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False, server_default="manual"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("updated_by", sa.Uuid(), nullable=True),
        sa.ForeignKeyConstraint(["artifact_id"], ["artifacts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_scm_links_project_id", "scm_links", ["project_id"])
    op.create_index("ix_scm_links_artifact_id", "scm_links", ["artifact_id"])
    op.create_index("ix_scm_links_task_id", "scm_links", ["task_id"])
    op.create_index(
        "uq_scm_links_artifact_web_url",
        "scm_links",
        ["artifact_id", "web_url"],
        unique=True,
    )
    op.create_index(
        "uq_scm_links_artifact_commit_sha",
        "scm_links",
        ["artifact_id", "commit_sha"],
        unique=True,
        postgresql_where=sa.text("commit_sha IS NOT NULL"),
    )
    op.create_index(
        "uq_scm_links_artifact_repo_pr",
        "scm_links",
        ["artifact_id", "repo_full_name", "pull_request_number"],
        unique=True,
        postgresql_where=sa.text("pull_request_number IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_scm_links_artifact_repo_pr", table_name="scm_links")
    op.drop_index("uq_scm_links_artifact_commit_sha", table_name="scm_links")
    op.drop_index("uq_scm_links_artifact_web_url", table_name="scm_links")
    op.drop_index("ix_scm_links_task_id", table_name="scm_links")
    op.drop_index("ix_scm_links_artifact_id", table_name="scm_links")
    op.drop_index("ix_scm_links_project_id", table_name="scm_links")
    op.drop_table("scm_links")

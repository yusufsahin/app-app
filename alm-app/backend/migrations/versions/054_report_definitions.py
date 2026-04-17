"""User-defined and SQL-based report definitions (QC-style), chart spec JSONB, validate/publish.

Revision ID: 054
Revises: 053
Create Date: 2026-04-13
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "054"
down_revision = "053"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "report_definitions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=True),
        sa.Column("created_by_id", sa.Uuid(), nullable=True),
        sa.Column("forked_from_id", sa.Uuid(), nullable=True),
        sa.Column("catalog_key", sa.String(length=128), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("visibility", sa.String(length=32), nullable=False, server_default="project"),
        sa.Column("query_kind", sa.String(length=32), nullable=False),
        sa.Column("builtin_report_id", sa.String(length=256), nullable=True),
        sa.Column("builtin_parameters", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("sql_text", sa.Text(), nullable=True),
        sa.Column("sql_bind_overrides", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("chart_spec", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("lifecycle_status", sa.String(length=32), nullable=False, server_default="draft"),
        sa.Column("last_validated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_validation_ok", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("last_validation_message", sa.Text(), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["forked_from_id"], ["report_definitions.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_report_definitions_tenant_project",
        "report_definitions",
        ["tenant_id", "project_id"],
        unique=False,
    )
    op.create_index(
        "ix_report_definitions_tenant_catalog",
        "report_definitions",
        ["tenant_id", "catalog_key"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_report_definitions_tenant_catalog", table_name="report_definitions")
    op.drop_index("ix_report_definitions_tenant_project", table_name="report_definitions")
    op.drop_table("report_definitions")

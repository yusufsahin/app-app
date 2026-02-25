"""Add workflow_rules table.

Revision ID: 025
Revises: 024
Create Date: 2026-02-24

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "025"
down_revision = "024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "workflow_rules",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("trigger_event_type", sa.String(100), nullable=False),
        sa.Column("condition_expression", sa.Text(), nullable=True),
        sa.Column("actions", JSONB, nullable=False, server_default="[]"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
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
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_workflow_rules_project_id", "workflow_rules", ["project_id"])
    op.create_index("ix_workflow_rules_trigger_event_type", "workflow_rules", ["trigger_event_type"])


def downgrade() -> None:
    op.drop_index("ix_workflow_rules_trigger_event_type", table_name="workflow_rules")
    op.drop_index("ix_workflow_rules_project_id", table_name="workflow_rules")
    op.drop_table("workflow_rules")

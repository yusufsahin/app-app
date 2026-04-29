"""Add AI module tables — provider configs, conversations, messages, pending actions, insights.

Revision ID: 059
Revises: 058
Create Date: 2026-04-29
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "059"
down_revision = "058"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── ai_provider_configs ──
    op.create_table(
        "ai_provider_configs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("provider", sa.String(100), nullable=False),
        sa.Column("model", sa.String(255), nullable=False),
        sa.Column("encrypted_api_key", sa.Text(), nullable=False, server_default=""),
        sa.Column("base_url", sa.String(1000), nullable=True),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_by", sa.Uuid(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_provider_configs_tenant_id", "ai_provider_configs", ["tenant_id"])

    # ── ai_conversations ──
    op.create_table(
        "ai_conversations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("project_id", sa.Uuid(), sa.ForeignKey("projects.id", ondelete="SET NULL"), nullable=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider_config_id", sa.Uuid(), sa.ForeignKey("ai_provider_configs.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("autonomy_level", sa.String(50), nullable=False, server_default="suggest"),
        sa.Column("title", sa.String(500), nullable=False, server_default=""),
        sa.Column("artifact_context_id", sa.Uuid(), sa.ForeignKey("artifacts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_by", sa.Uuid(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_conversations_tenant_id", "ai_conversations", ["tenant_id"])
    op.create_index("ix_ai_conversations_project_id", "ai_conversations", ["project_id"])
    op.create_index("ix_ai_conversations_user_id", "ai_conversations", ["user_id"])

    # ── ai_messages ──
    op.create_table(
        "ai_messages",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("conversation_id", sa.Uuid(), sa.ForeignKey("ai_conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(50), nullable=False),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("tool_calls", postgresql.JSONB(), nullable=True),
        sa.Column("tool_results", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_messages_conversation_id", "ai_messages", ["conversation_id"])

    # ── ai_pending_actions ──
    op.create_table(
        "ai_pending_actions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("conversation_id", sa.Uuid(), sa.ForeignKey("ai_conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("message_id", sa.Uuid(), sa.ForeignKey("ai_messages.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tool_name", sa.String(255), nullable=False),
        sa.Column("tool_args", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("status", sa.String(50), nullable=False, server_default="pending"),
        sa.Column("executed_result", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_by", sa.Uuid(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_pending_actions_conversation_id", "ai_pending_actions", ["conversation_id"])
    op.create_index("ix_ai_pending_actions_status", "ai_pending_actions", ["status"])

    # ── ai_insights ──
    op.create_table(
        "ai_insights",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("project_id", sa.Uuid(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("insight_type", sa.String(100), nullable=False),
        sa.Column("severity", sa.String(50), nullable=False, server_default="info"),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("body", sa.Text(), nullable=False, server_default=""),
        sa.Column("context", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("is_dismissed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_insights_tenant_id", "ai_insights", ["tenant_id"])
    op.create_index("ix_ai_insights_project_id", "ai_insights", ["project_id"])


def downgrade() -> None:
    op.drop_table("ai_insights")
    op.drop_table("ai_pending_actions")
    op.drop_table("ai_messages")
    op.drop_table("ai_conversations")
    op.drop_table("ai_provider_configs")

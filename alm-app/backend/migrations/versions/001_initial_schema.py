"""Initial schema — Auth, Tenant, Audit tables.

Revision ID: 001
Revises: -
Create Date: 2026-02-22
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Users ──
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("display_name", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("email_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_by", sa.Uuid(), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.Uuid(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_deleted_at", "users", ["deleted_at"])

    # ── Refresh Tokens ──
    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.String(255), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_by", sa.Uuid(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])
    op.create_index("ix_refresh_tokens_token_hash", "refresh_tokens", ["token_hash"], unique=True)

    # ── Tenants ──
    op.create_table(
        "tenants",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(255), nullable=False),
        sa.Column("tier", sa.String(50), nullable=False, server_default=sa.text("'free'")),
        sa.Column("settings", postgresql.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_by", sa.Uuid(), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.Uuid(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tenants_slug", "tenants", ["slug"], unique=True)
    op.create_index("ix_tenants_deleted_at", "tenants", ["deleted_at"])

    # ── Tenant Memberships ──
    op.create_table(
        "tenant_memberships",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("invited_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_by", sa.Uuid(), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.Uuid(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "tenant_id", name="uq_membership_user_tenant"),
    )
    op.create_index("ix_memberships_user_id", "tenant_memberships", ["user_id"])
    op.create_index("ix_memberships_tenant_id", "tenant_memberships", ["tenant_id"])
    op.create_index("ix_memberships_deleted_at", "tenant_memberships", ["deleted_at"])

    # ── Roles ──
    op.create_table(
        "roles",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=sa.text("''")),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("hierarchy_level", sa.Integer(), nullable=False, server_default=sa.text("100")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_by", sa.Uuid(), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.Uuid(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tenant_id", "slug", name="uq_role_tenant_slug"),
    )
    op.create_index("ix_roles_tenant_id", "roles", ["tenant_id"])
    op.create_index("ix_roles_deleted_at", "roles", ["deleted_at"])

    # ── Privileges ──
    op.create_table(
        "privileges",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.String(100), nullable=False),
        sa.Column("resource", sa.String(50), nullable=False),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=sa.text("''")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_privileges_code", "privileges", ["code"], unique=True)

    # ── Role Privileges (N:N) ──
    op.create_table(
        "role_privileges",
        sa.Column("role_id", sa.Uuid(), sa.ForeignKey("roles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("privilege_id", sa.Uuid(), sa.ForeignKey("privileges.id", ondelete="CASCADE"), nullable=False),
        sa.PrimaryKeyConstraint("role_id", "privilege_id"),
    )

    # ── Membership Roles (N:N) ──
    op.create_table(
        "membership_roles",
        sa.Column(
            "membership_id",
            sa.Uuid(),
            sa.ForeignKey("tenant_memberships.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role_id", sa.Uuid(), sa.ForeignKey("roles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("assigned_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("assigned_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=True),
        sa.PrimaryKeyConstraint("membership_id", "role_id"),
    )

    # ── Invitations ──
    op.create_table(
        "invitations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("invited_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("token", sa.String(255), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_by", sa.Uuid(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_invitations_tenant_id", "invitations", ["tenant_id"])
    op.create_index("ix_invitations_token", "invitations", ["token"], unique=True)

    # ── Invitation Roles (N:N) ──
    op.create_table(
        "invitation_roles",
        sa.Column(
            "invitation_id",
            sa.Uuid(),
            sa.ForeignKey("invitations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role_id", sa.Uuid(), sa.ForeignKey("roles.id", ondelete="CASCADE"), nullable=False),
        sa.PrimaryKeyConstraint("invitation_id", "role_id"),
    )

    # ── Audit Commits ──
    op.create_table(
        "audit_commits",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("author_id", sa.Uuid(), nullable=True),
        sa.Column("tenant_id", sa.Uuid(), nullable=True),
        sa.Column("committed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("properties", postgresql.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.PrimaryKeyConstraint("id"),
    )

    # ── Audit Snapshots ──
    op.create_table(
        "audit_snapshots",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "commit_id", sa.Uuid(), sa.ForeignKey("audit_commits.id"), nullable=False
        ),
        sa.Column("global_id", sa.String(500), nullable=False),
        sa.Column("entity_type", sa.String(128), nullable=False),
        sa.Column("entity_id", sa.Uuid(), nullable=False),
        sa.Column("change_type", sa.String(16), nullable=False),
        sa.Column("state", postgresql.JSON(), nullable=False),
        sa.Column("changed_properties", postgresql.ARRAY(sa.String()), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_snapshot_commit_id", "audit_snapshots", ["commit_id"])
    op.create_index("ix_snapshot_global_id", "audit_snapshots", ["global_id"])
    op.create_index("ix_snapshot_entity_type", "audit_snapshots", ["entity_type"])
    op.create_index("ix_snapshot_entity_id", "audit_snapshots", ["entity_id"])
    op.create_index(
        "ix_snapshot_entity_version",
        "audit_snapshots",
        ["entity_type", "entity_id", "version"],
    )


def downgrade() -> None:
    op.drop_table("audit_snapshots")
    op.drop_table("audit_commits")
    op.drop_table("invitation_roles")
    op.drop_table("invitations")
    op.drop_table("membership_roles")
    op.drop_table("role_privileges")
    op.drop_table("privileges")
    op.drop_table("roles")
    op.drop_table("tenant_memberships")
    op.drop_table("tenants")
    op.drop_table("refresh_tokens")
    op.drop_table("users")

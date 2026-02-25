"""Add access_audit table (G5 — login/API access audit).

Revision ID: 027
Revises: 026
Create Date: 2026-02-25

"""
from alembic import op
import sqlalchemy as sa

revision = "027"
down_revision = "026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "access_audit",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("type", sa.String(32), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("ip", sa.String(64), nullable=True),
        sa.Column("user_agent", sa.String(512), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_access_audit_timestamp", "access_audit", ["timestamp"])
    op.create_index("ix_access_audit_type", "access_audit", ["type"])


def downgrade() -> None:
    op.drop_index("ix_access_audit_type", table_name="access_audit")
    op.drop_index("ix_access_audit_timestamp", table_name="access_audit")
    op.drop_table("access_audit")

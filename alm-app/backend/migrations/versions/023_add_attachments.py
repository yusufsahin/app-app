"""Add attachments table (artifact file attachments).

Revision ID: 023
Revises: 022
Create Date: 2026-02-24

"""
from alembic import op
import sqlalchemy as sa

revision = "023"
down_revision = "022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "attachments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("artifact_id", sa.Uuid(), nullable=False),
        sa.Column("file_name", sa.String(512), nullable=False),
        sa.Column("content_type", sa.String(255), nullable=False, server_default="application/octet-stream"),
        sa.Column("size", sa.Integer(), nullable=False),
        sa.Column("storage_key", sa.String(1024), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["artifact_id"],
            ["artifacts.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_attachments_project_id", "attachments", ["project_id"])
    op.create_index("ix_attachments_artifact_id", "attachments", ["artifact_id"])
    op.create_index("ix_attachments_created_by", "attachments", ["created_by"])
    op.create_index("ix_attachments_storage_key", "attachments", ["storage_key"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_attachments_storage_key", table_name="attachments")
    op.drop_index("ix_attachments_created_by", table_name="attachments")
    op.drop_index("ix_attachments_artifact_id", table_name="attachments")
    op.drop_index("ix_attachments_project_id", table_name="attachments")
    op.drop_table("attachments")

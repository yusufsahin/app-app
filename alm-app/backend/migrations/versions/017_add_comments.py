"""Add comments table (artifact-linked).

Revision ID: 017
Revises: 016
Create Date: 2026-02-24

"""
from alembic import op
import sqlalchemy as sa

revision = "017"
down_revision = "016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "comments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("artifact_id", sa.Uuid(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
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
    op.create_index("ix_comments_project_id", "comments", ["project_id"])
    op.create_index("ix_comments_artifact_id", "comments", ["artifact_id"])
    op.create_index("ix_comments_created_by", "comments", ["created_by"])


def downgrade() -> None:
    op.drop_index("ix_comments_created_by", table_name="comments")
    op.drop_index("ix_comments_artifact_id", table_name="comments")
    op.drop_index("ix_comments_project_id", table_name="comments")
    op.drop_table("comments")

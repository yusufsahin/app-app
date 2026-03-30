"""Task–project tag links (same vocabulary as artifact tags).

Revision ID: 039
Revises: 038
Create Date: 2026-03-30
"""

from alembic import op
import sqlalchemy as sa

revision = "039"
down_revision = "038"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "task_tags",
        sa.Column("task_id", sa.Uuid(), nullable=False),
        sa.Column("tag_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["task_id"],
            ["tasks.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["tag_id"],
            ["project_tags.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("task_id", "tag_id"),
    )
    op.create_index("ix_task_tags_tag_id", "task_tags", ["tag_id"])


def downgrade() -> None:
    op.drop_index("ix_task_tags_tag_id", table_name="task_tags")
    op.drop_table("task_tags")

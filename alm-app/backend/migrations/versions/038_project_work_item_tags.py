"""Project-scoped work item tags (ADO-style vocabulary) + artifact assignment.

Revision ID: 038
Revises: 037
Create Date: 2026-03-30
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = "038"
down_revision = "037"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "project_tags",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(128), nullable=False),
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
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_project_tags_project_id", "project_tags", ["project_id"])
    op.create_index(
        "uq_project_tags_project_lower_name",
        "project_tags",
        ["project_id", text("lower(name)")],
        unique=True,
    )

    op.create_table(
        "artifact_tags",
        sa.Column("artifact_id", sa.Uuid(), nullable=False),
        sa.Column("tag_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["artifact_id"],
            ["artifacts.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["tag_id"],
            ["project_tags.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("artifact_id", "tag_id"),
    )
    op.create_index("ix_artifact_tags_tag_id", "artifact_tags", ["tag_id"])


def downgrade() -> None:
    op.drop_index("ix_artifact_tags_tag_id", table_name="artifact_tags")
    op.drop_table("artifact_tags")
    op.drop_index("uq_project_tags_project_lower_name", table_name="project_tags")
    op.drop_index("ix_project_tags_project_id", table_name="project_tags")
    op.drop_table("project_tags")

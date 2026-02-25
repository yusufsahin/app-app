"""Add artifact_links table (traceability).

Revision ID: 022
Revises: 021
Create Date: 2026-02-24

"""
from alembic import op
import sqlalchemy as sa

revision = "022"
down_revision = "021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "artifact_links",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("from_artifact_id", sa.Uuid(), nullable=False),
        sa.Column("to_artifact_id", sa.Uuid(), nullable=False),
        sa.Column("link_type", sa.String(100), nullable=False),
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
        sa.ForeignKeyConstraint(
            ["from_artifact_id"],
            ["artifacts.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["to_artifact_id"],
            ["artifacts.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_artifact_links_project_id", "artifact_links", ["project_id"])
    op.create_index("ix_artifact_links_from_artifact_id", "artifact_links", ["from_artifact_id"])
    op.create_index("ix_artifact_links_to_artifact_id", "artifact_links", ["to_artifact_id"])
    op.create_index("ix_artifact_links_link_type", "artifact_links", ["link_type"])


def downgrade() -> None:
    op.drop_index("ix_artifact_links_link_type", table_name="artifact_links")
    op.drop_index("ix_artifact_links_to_artifact_id", table_name="artifact_links")
    op.drop_index("ix_artifact_links_from_artifact_id", table_name="artifact_links")
    op.drop_index("ix_artifact_links_project_id", table_name="artifact_links")
    op.drop_table("artifact_links")

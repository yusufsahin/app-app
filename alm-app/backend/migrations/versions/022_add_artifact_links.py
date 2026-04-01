"""Add relationships table (traceability).

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
        "relationships",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("source_artifact_id", sa.Uuid(), nullable=False),
        sa.Column("target_artifact_id", sa.Uuid(), nullable=False),
        sa.Column("relationship_type", sa.String(100), nullable=False),
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
            ["source_artifact_id"],
            ["artifacts.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["target_artifact_id"],
            ["artifacts.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_relationships_project_id", "relationships", ["project_id"])
    op.create_index("ix_relationships_source_artifact_id", "relationships", ["source_artifact_id"])
    op.create_index("ix_relationships_target_artifact_id", "relationships", ["target_artifact_id"])
    op.create_index("ix_relationships_relationship_type", "relationships", ["relationship_type"])


def downgrade() -> None:
    op.drop_index("ix_relationships_relationship_type", table_name="relationships")
    op.drop_index("ix_relationships_target_artifact_id", table_name="relationships")
    op.drop_index("ix_relationships_source_artifact_id", table_name="relationships")
    op.drop_index("ix_relationships_project_id", table_name="relationships")
    op.drop_table("relationships")

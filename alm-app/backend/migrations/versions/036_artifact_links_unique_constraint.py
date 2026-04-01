"""Add unique constraint for relationships.

Revision ID: 036
Revises: 035
Create Date: 2026-03-26
"""

from alembic import op

revision = "036"
down_revision = "035"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_relationships_project_from_to_type",
        "relationships",
        ["project_id", "source_artifact_id", "target_artifact_id", "relationship_type"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_relationships_project_from_to_type", "relationships", type_="unique")

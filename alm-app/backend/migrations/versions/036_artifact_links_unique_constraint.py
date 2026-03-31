"""Add unique constraint for artifact links.

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
        "uq_artifact_links_project_from_to_type",
        "artifact_links",
        ["project_id", "from_artifact_id", "to_artifact_id", "link_type"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_artifact_links_project_from_to_type", "artifact_links", type_="unique")

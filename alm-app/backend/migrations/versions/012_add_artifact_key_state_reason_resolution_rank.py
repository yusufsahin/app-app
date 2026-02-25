"""Add artifact_key, state_reason, resolution, rank_order to artifacts.

Revision ID: 012
Revises: 011
Create Date: 2026-02-23

"""
from alembic import op
import sqlalchemy as sa

revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "artifacts",
        sa.Column("artifact_key", sa.String(50), nullable=True),
    )
    op.add_column(
        "artifacts",
        sa.Column("state_reason", sa.String(255), nullable=True),
    )
    op.add_column(
        "artifacts",
        sa.Column("resolution", sa.String(100), nullable=True),
    )
    op.add_column(
        "artifacts",
        sa.Column("rank_order", sa.Float(), nullable=True),
    )
    op.create_index("ix_artifacts_artifact_key", "artifacts", ["artifact_key"])
    op.create_unique_constraint(
        "uq_artifact_project_key",
        "artifacts",
        ["project_id", "artifact_key"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_artifact_project_key", "artifacts", type_="unique")
    op.drop_index("ix_artifacts_artifact_key", table_name="artifacts")
    op.drop_column("artifacts", "rank_order")
    op.drop_column("artifacts", "resolution")
    op.drop_column("artifacts", "state_reason")
    op.drop_column("artifacts", "artifact_key")

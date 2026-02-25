"""Add area_node_id and area_path_snapshot to artifacts.

Revision ID: 021
Revises: 020
Create Date: 2026-02-24

"""
from alembic import op
import sqlalchemy as sa

revision = "021"
down_revision = "020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "artifacts",
        sa.Column("area_node_id", sa.Uuid(), nullable=True),
    )
    op.add_column(
        "artifacts",
        sa.Column("area_path_snapshot", sa.String(512), nullable=True),
    )
    op.create_foreign_key(
        "fk_artifacts_area_node_id",
        "artifacts",
        "area_nodes",
        ["area_node_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_artifacts_area_node_id", "artifacts", ["area_node_id"])


def downgrade() -> None:
    op.drop_index("ix_artifacts_area_node_id", table_name="artifacts")
    op.drop_constraint("fk_artifacts_area_node_id", "artifacts", type_="foreignkey")
    op.drop_column("artifacts", "area_path_snapshot")
    op.drop_column("artifacts", "area_node_id")

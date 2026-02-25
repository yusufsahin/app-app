"""Add cycle_node_id to artifacts.

Revision ID: 019
Revises: 018
Create Date: 2026-02-24

"""
from alembic import op
import sqlalchemy as sa

revision = "019"
down_revision = "018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "artifacts",
        sa.Column("cycle_node_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        "fk_artifacts_cycle_node_id",
        "artifacts",
        "cycle_nodes",
        ["cycle_node_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_artifacts_cycle_node_id", "artifacts", ["cycle_node_id"])


def downgrade() -> None:
    op.drop_index("ix_artifacts_cycle_node_id", table_name="artifacts")
    op.drop_constraint("fk_artifacts_cycle_node_id", "artifacts", type_="foreignkey")
    op.drop_column("artifacts", "cycle_node_id")

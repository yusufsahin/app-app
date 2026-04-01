"""Rename cycle_node_id columns to cycle_id.

Revision ID: 043
Revises: 042
Create Date: 2026-04-01
"""

from alembic import op
import sqlalchemy as sa

revision = "043"
down_revision = "042"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_index("ix_artifacts_cycle_node_id", table_name="artifacts")
    op.drop_constraint("fk_artifacts_cycle_node_id", "artifacts", type_="foreignkey")
    op.alter_column("artifacts", "cycle_node_id", new_column_name="cycle_id")
    op.create_foreign_key(
        "fk_artifacts_cycle_id",
        "artifacts",
        "cycle_nodes",
        ["cycle_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_artifacts_cycle_id", "artifacts", ["cycle_id"])

    op.drop_index("ix_capacities_cycle_node_id", table_name="capacities")
    op.drop_constraint("capacities_cycle_node_id_fkey", "capacities", type_="foreignkey")
    op.alter_column("capacities", "cycle_node_id", new_column_name="cycle_id")
    op.create_foreign_key(
        "fk_capacities_cycle_id",
        "capacities",
        "cycle_nodes",
        ["cycle_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_capacities_cycle_id", "capacities", ["cycle_id"])


def downgrade() -> None:
    op.drop_index("ix_capacities_cycle_id", table_name="capacities")
    op.drop_constraint("fk_capacities_cycle_id", "capacities", type_="foreignkey")
    op.alter_column("capacities", "cycle_id", new_column_name="cycle_node_id")
    op.create_foreign_key(
        "capacities_cycle_node_id_fkey",
        "capacities",
        "cycle_nodes",
        ["cycle_node_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_capacities_cycle_node_id", "capacities", ["cycle_node_id"])

    op.drop_index("ix_artifacts_cycle_id", table_name="artifacts")
    op.drop_constraint("fk_artifacts_cycle_id", "artifacts", type_="foreignkey")
    op.alter_column("artifacts", "cycle_id", new_column_name="cycle_node_id")
    op.create_foreign_key(
        "fk_artifacts_cycle_node_id",
        "artifacts",
        "cycle_nodes",
        ["cycle_node_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_artifacts_cycle_node_id", "artifacts", ["cycle_node_id"])

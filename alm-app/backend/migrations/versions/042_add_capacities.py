"""Add capacities table.

Revision ID: 042
Revises: 041
Create Date: 2026-03-30
"""

from alembic import op
import sqlalchemy as sa

revision = "042"
down_revision = "041"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "capacities",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("cycle_node_id", sa.Uuid(), nullable=True),
        sa.Column("team_id", sa.Uuid(), nullable=True),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("capacity_value", sa.Float(), nullable=False, server_default="0"),
        sa.Column("unit", sa.String(length=32), nullable=False, server_default="hours"),
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
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["cycle_node_id"], ["cycle_nodes.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("capacity_value >= 0", name="ck_capacities_non_negative"),
    )
    op.create_index("ix_capacities_project_id", "capacities", ["project_id"])
    op.create_index("ix_capacities_cycle_node_id", "capacities", ["cycle_node_id"])
    op.create_index("ix_capacities_team_id", "capacities", ["team_id"])
    op.create_index("ix_capacities_user_id", "capacities", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_capacities_user_id", table_name="capacities")
    op.drop_index("ix_capacities_team_id", table_name="capacities")
    op.drop_index("ix_capacities_cycle_node_id", table_name="capacities")
    op.drop_index("ix_capacities_project_id", table_name="capacities")
    op.drop_table("capacities")


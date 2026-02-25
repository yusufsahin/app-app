"""Add cycle_nodes table (planning tree, pamera IterationNode-like).

Revision ID: 018
Revises: 017
Create Date: 2026-02-24

"""
from alembic import op
import sqlalchemy as sa

revision = "018"
down_revision = "017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "cycle_nodes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("parent_id", sa.Uuid(), nullable=True),
        sa.Column("path", sa.String(512), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("depth", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("goal", sa.Text(), nullable=False, server_default=""),
        sa.Column("state", sa.String(50), nullable=False, server_default="planned"),
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
        sa.ForeignKeyConstraint(
            ["parent_id"],
            ["cycle_nodes.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_cycle_nodes_project_id", "cycle_nodes", ["project_id"])
    op.create_index("ix_cycle_nodes_parent_id", "cycle_nodes", ["parent_id"])
    op.create_index(
        "ix_cycle_nodes_project_path",
        "cycle_nodes",
        ["project_id", "path"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_cycle_nodes_project_path", table_name="cycle_nodes")
    op.drop_index("ix_cycle_nodes_parent_id", table_name="cycle_nodes")
    op.drop_index("ix_cycle_nodes_project_id", table_name="cycle_nodes")
    op.drop_table("cycle_nodes")

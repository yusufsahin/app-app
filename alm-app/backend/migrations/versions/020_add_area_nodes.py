"""Add area_nodes table (project area tree, pamera AreaNode-like).

Revision ID: 020
Revises: 019
Create Date: 2026-02-24

"""
from alembic import op
import sqlalchemy as sa

revision = "020"
down_revision = "019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "area_nodes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("parent_id", sa.Uuid(), nullable=True),
        sa.Column("path", sa.String(512), nullable=False),
        sa.Column("depth", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
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
            ["area_nodes.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("project_id", "path", name="uq_area_nodes_project_path"),
    )
    op.create_index("ix_area_nodes_project_id", "area_nodes", ["project_id"])
    op.create_index("ix_area_nodes_parent_id", "area_nodes", ["parent_id"])


def downgrade() -> None:
    op.drop_index("ix_area_nodes_parent_id", table_name="area_nodes")
    op.drop_index("ix_area_nodes_project_id", table_name="area_nodes")
    op.drop_table("area_nodes")

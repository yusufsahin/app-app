"""Add created_by and updated_by to cycle_nodes and area_nodes (TimestampMixin).

Revision ID: 028
Revises: 027
Create Date: 2026-02-25

"""
from alembic import op
import sqlalchemy as sa

revision = "028"
down_revision = "027"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "cycle_nodes",
        sa.Column("created_by", sa.Uuid(), nullable=True),
    )
    op.add_column(
        "cycle_nodes",
        sa.Column("updated_by", sa.Uuid(), nullable=True),
    )
    op.add_column(
        "area_nodes",
        sa.Column("created_by", sa.Uuid(), nullable=True),
    )
    op.add_column(
        "area_nodes",
        sa.Column("updated_by", sa.Uuid(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("area_nodes", "updated_by")
    op.drop_column("area_nodes", "created_by")
    op.drop_column("cycle_nodes", "updated_by")
    op.drop_column("cycle_nodes", "created_by")

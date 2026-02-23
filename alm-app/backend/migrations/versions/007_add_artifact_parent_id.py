"""Add parent_id to artifacts for hierarchy.

Revision ID: 007
Revises: 006
Create Date: 2026-02-23

"""
from alembic import op
import sqlalchemy as sa

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "artifacts",
        sa.Column("parent_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        "fk_artifacts_parent_id",
        "artifacts",
        "artifacts",
        ["parent_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_artifacts_parent_id", "artifacts", ["parent_id"])


def downgrade() -> None:
    op.drop_index("ix_artifacts_parent_id", table_name="artifacts")
    op.drop_constraint("fk_artifacts_parent_id", "artifacts", type_="foreignkey")
    op.drop_column("artifacts", "parent_id")

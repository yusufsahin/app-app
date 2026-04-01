"""Add sort_order to relationships for ordered suite membership.

Revision ID: 037
Revises: 036
Create Date: 2026-03-28
"""

from alembic import op
import sqlalchemy as sa

revision = "037"
down_revision = "036"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "relationships",
        sa.Column("sort_order", sa.Integer(), nullable=True),
    )
    # Backfill: per (source_artifact_id, relationship_type), order by created_at ascending → 0..n-1
    op.execute(
        sa.text(
            """
            UPDATE relationships al
            SET sort_order = sub.rn
            FROM (
                SELECT id,
                       (ROW_NUMBER() OVER (
                           PARTITION BY source_artifact_id, relationship_type
                           ORDER BY created_at ASC
                       ) - 1)::integer AS rn
                FROM relationships
            ) AS sub
            WHERE al.id = sub.id
            """
        )
    )


def downgrade() -> None:
    op.drop_column("relationships", "sort_order")

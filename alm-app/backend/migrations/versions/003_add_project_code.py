"""Add project code column.

Revision ID: 003
Revises: 002
Create Date: 2026-02-23

"""

from alembic import op
import sqlalchemy as sa

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("code", sa.String(10), nullable=True),
    )
    # Backfill existing rows: PRJ + 4-digit row number per tenant
    op.execute("""
        UPDATE projects p SET code = (
            SELECT 'PRJ' || LPAD(
                (ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at))::text,
                4, '0'
            )
            FROM projects p2
            WHERE p2.id = p.id
        )
        WHERE code IS NULL
    """)
    op.alter_column(
        "projects",
        "code",
        existing_type=sa.String(10),
        nullable=False,
    )
    op.create_unique_constraint(
        "uq_project_tenant_code",
        "projects",
        ["tenant_id", "code"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_project_tenant_code", "projects", type_="unique")
    op.drop_column("projects", "code")

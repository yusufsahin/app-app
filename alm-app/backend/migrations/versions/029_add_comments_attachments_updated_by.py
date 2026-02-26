"""Add updated_by to comments and attachments (TimestampMixin alignment).

Revision ID: 029
Revises: 028
Create Date: 2026-02-26

"""
from alembic import op
import sqlalchemy as sa

revision = "029"
down_revision = "028"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "comments",
        sa.Column("updated_by", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        "fk_comments_updated_by_users",
        "comments",
        "users",
        ["updated_by"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_comments_updated_by", "comments", ["updated_by"])

    op.add_column(
        "attachments",
        sa.Column("updated_by", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        "fk_attachments_updated_by_users",
        "attachments",
        "users",
        ["updated_by"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_attachments_updated_by", "attachments", ["updated_by"])


def downgrade() -> None:
    op.drop_index("ix_attachments_updated_by", table_name="attachments")
    op.drop_constraint("fk_attachments_updated_by_users", "attachments", type_="foreignkey")
    op.drop_column("attachments", "updated_by")

    op.drop_index("ix_comments_updated_by", table_name="comments")
    op.drop_constraint("fk_comments_updated_by_users", "comments", type_="foreignkey")
    op.drop_column("comments", "updated_by")

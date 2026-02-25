"""Add artifacts search_vector (FTS) and GIN index.

Revision ID: 016
Revises: 015
Create Date: 2026-02-24

"""
from alembic import op

revision = "016"
down_revision = "015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE artifacts
        ADD COLUMN search_vector tsvector
        GENERATED ALWAYS AS (
            to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
        ) STORED
    """)
    op.create_index(
        "idx_artifacts_search_vector",
        "artifacts",
        ["search_vector"],
        postgresql_using="gin",
    )


def downgrade() -> None:
    op.drop_index("idx_artifacts_search_vector", table_name="artifacts")
    op.drop_column("artifacts", "search_vector")

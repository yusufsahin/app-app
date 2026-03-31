"""Add team_id to artifacts and tasks.

Revision ID: 041
Revises: 040
Create Date: 2026-03-30
"""

from alembic import op
import sqlalchemy as sa

revision = "041"
down_revision = "040"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("artifacts", sa.Column("team_id", sa.Uuid(), nullable=True))
    op.create_index("ix_artifacts_team_id", "artifacts", ["team_id"])
    op.create_foreign_key(
        "fk_artifacts_team_id_teams",
        "artifacts",
        "teams",
        ["team_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.add_column("tasks", sa.Column("team_id", sa.Uuid(), nullable=True))
    op.create_index("ix_tasks_team_id", "tasks", ["team_id"])
    op.create_foreign_key(
        "fk_tasks_team_id_teams",
        "tasks",
        "teams",
        ["team_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_tasks_team_id_teams", "tasks", type_="foreignkey")
    op.drop_index("ix_tasks_team_id", table_name="tasks")
    op.drop_column("tasks", "team_id")

    op.drop_constraint("fk_artifacts_team_id_teams", "artifacts", type_="foreignkey")
    op.drop_index("ix_artifacts_team_id", table_name="artifacts")
    op.drop_column("artifacts", "team_id")


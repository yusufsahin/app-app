"""Add task original_estimate_hours, remaining_work_hours, activity.

Revision ID: 047
Revises: 046
Create Date: 2026-04-05
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "047"
down_revision = "046"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tasks",
        sa.Column("original_estimate_hours", sa.Float(), nullable=True),
    )
    op.add_column(
        "tasks",
        sa.Column("remaining_work_hours", sa.Float(), nullable=True),
    )
    op.add_column(
        "tasks",
        sa.Column("activity", sa.String(length=64), nullable=True),
    )
    op.create_check_constraint(
        "ck_tasks_original_estimate_hours_nonneg",
        "tasks",
        "original_estimate_hours IS NULL OR original_estimate_hours >= 0",
    )
    op.create_check_constraint(
        "ck_tasks_remaining_work_hours_nonneg",
        "tasks",
        "remaining_work_hours IS NULL OR remaining_work_hours >= 0",
    )


def downgrade() -> None:
    op.drop_constraint("ck_tasks_remaining_work_hours_nonneg", "tasks", type_="check")
    op.drop_constraint("ck_tasks_original_estimate_hours_nonneg", "tasks", type_="check")
    op.drop_column("tasks", "activity")
    op.drop_column("tasks", "remaining_work_hours")
    op.drop_column("tasks", "original_estimate_hours")

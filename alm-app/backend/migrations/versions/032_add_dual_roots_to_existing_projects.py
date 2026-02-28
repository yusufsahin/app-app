"""Add root-requirement and root-quality artifacts to existing projects (Dual-Root backfill).

Revision ID: 032
Revises: 031
Create Date: 2026-02-28

Projects that have process_template_version_id but no root artifacts get two new artifacts:
{code}-R0 (root-requirement) and {code}-Q0 (root-quality), state 'Active'.
"""
import uuid
from alembic import op
import sqlalchemy as sa

revision = "032"
down_revision = "031"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    # Projects with a template that might have been created before dual-root
    rows = conn.execute(
        sa.text(
            "SELECT id, code, name FROM projects WHERE process_template_version_id IS NOT NULL"
        )
    ).fetchall()

    for (project_id, code, name) in rows:
        if not code or not name:
            continue
        # Check existing roots (non-deleted)
        existing = conn.execute(
            sa.text(
                "SELECT artifact_type FROM artifacts WHERE project_id = :pid AND artifact_type IN ('root-requirement', 'root-quality') AND deleted_at IS NULL"
            ),
            {"pid": str(project_id)},
        ).fetchall()
        have_req = any(r[0] == "root-requirement" for r in existing)
        have_qual = any(r[0] == "root-quality" for r in existing)

        title = (name or "Project")[:500]
        desc = ""

        if not have_req:
            rid = uuid.uuid4()
            conn.execute(
                sa.text(
                    """
                    INSERT INTO artifacts (id, project_id, artifact_type, title, description, state, artifact_key, parent_id, custom_fields)
                    VALUES (:id, :project_id, 'root-requirement', :title, :desc, 'Active', :key, NULL, '{}')
                    """
                ),
                {
                    "id": str(rid),
                    "project_id": str(project_id),
                    "title": title,
                    "desc": desc,
                    "key": f"{code}-R0",
                },
            )
        if not have_qual:
            qid = uuid.uuid4()
            conn.execute(
                sa.text(
                    """
                    INSERT INTO artifacts (id, project_id, artifact_type, title, description, state, artifact_key, parent_id, custom_fields)
                    VALUES (:id, :project_id, 'root-quality', :title, :desc, 'Active', :key, NULL, '{}')
                    """
                ),
                {
                    "id": str(qid),
                    "project_id": str(project_id),
                    "title": title,
                    "desc": desc,
                    "key": f"{code}-Q0",
                },
            )


def downgrade() -> None:
    # Removes all root artifacts with keys ending -R0 / -Q0 (including app-created ones).
    conn = op.get_bind()
    conn.execute(
        sa.text(
            "DELETE FROM artifacts WHERE artifact_type = 'root-requirement' AND artifact_key LIKE '%-R0'"
        )
    )
    conn.execute(
        sa.text(
            "DELETE FROM artifacts WHERE artifact_type = 'root-quality' AND artifact_key LIKE '%-Q0'"
        )
    )

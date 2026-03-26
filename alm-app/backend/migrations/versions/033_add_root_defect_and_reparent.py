"""Add root-defect (D0) to existing projects and reparent defect/bug under D0.

Revision ID: 033
Revises: 032
Create Date: 2026-02-28

- Projects with process_template_version_id that lack root-defect get {code}-D0 (state Active).
- Artifacts of type defect/bug whose parent_id is the project's R0 are reparented to D0.
"""
import uuid
from alembic import op
import sqlalchemy as sa

revision = "033"
down_revision = "032"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    rows = conn.execute(
        sa.text(
            "SELECT id, code, name FROM projects WHERE process_template_version_id IS NOT NULL"
        )
    ).fetchall()

    for (project_id, code, name) in rows:
        if not code or not name:
            continue
        existing = conn.execute(
            sa.text(
                "SELECT id FROM artifacts WHERE project_id = :pid AND artifact_type = 'root-defect' AND deleted_at IS NULL"
            ),
            {"pid": str(project_id)},
        ).fetchone()
        if existing:
            d0_id = existing[0]
        else:
            d0_id = uuid.uuid4()
            title = (name or "Project")[:500]
            conn.execute(
                sa.text(
                    """
                    INSERT INTO artifacts (id, project_id, artifact_type, title, description, state, artifact_key, parent_id, custom_fields)
                    VALUES (:id, :project_id, 'root-defect', :title, '', 'Active', :key, NULL, '{}')
                    """
                ),
                {
                    "id": str(d0_id),
                    "project_id": str(project_id),
                    "title": title,
                    "key": f"{code}-D0",
                },
            )

        r0_row = conn.execute(
            sa.text(
                "SELECT id FROM artifacts WHERE project_id = :pid AND artifact_type = 'root-requirement' AND deleted_at IS NULL LIMIT 1"
            ),
            {"pid": str(project_id)},
        ).fetchone()
        if r0_row:
            r0_id = r0_row[0]
            conn.execute(
                sa.text(
                    """
                    UPDATE artifacts
                    SET parent_id = :d0_id
                    WHERE project_id = :pid AND artifact_type IN ('defect', 'bug') AND parent_id = :r0_id AND deleted_at IS NULL
                    """
                ),
                {"d0_id": str(d0_id), "pid": str(project_id), "r0_id": str(r0_id)},
            )


def downgrade() -> None:
    conn = op.get_bind()
    rows = conn.execute(
        sa.text(
            "SELECT id FROM projects WHERE process_template_version_id IS NOT NULL"
        )
    ).fetchall()

    for (project_id,) in rows:
        d0_row = conn.execute(
            sa.text(
                "SELECT id FROM artifacts WHERE project_id = :pid AND artifact_type = 'root-defect' AND artifact_key LIKE '%-D0' AND deleted_at IS NULL"
            ),
            {"pid": str(project_id)},
        ).fetchone()
        if not d0_row:
            continue
        d0_id = d0_row[0]
        r0_row = conn.execute(
            sa.text(
                "SELECT id FROM artifacts WHERE project_id = :pid AND artifact_type = 'root-requirement' AND deleted_at IS NULL LIMIT 1"
            ),
            {"pid": str(project_id)},
        ).fetchone()
        if r0_row:
            r0_id = r0_row[0]
            conn.execute(
                sa.text(
                    """
                    UPDATE artifacts
                    SET parent_id = :r0_id
                    WHERE project_id = :pid AND artifact_type IN ('defect', 'bug') AND parent_id = :d0_id AND deleted_at IS NULL
                    """
                ),
                {"r0_id": str(r0_id), "pid": str(project_id), "d0_id": str(d0_id)},
            )

    conn.execute(
        sa.text(
            "DELETE FROM artifacts WHERE artifact_type = 'root-defect' AND artifact_key LIKE '%-D0'"
        )
    )

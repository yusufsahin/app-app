"""Add state_reason_options and resolution_options to existing workflow defs in manifests.

Revision ID: 014
Revises: 013
Create Date: 2026-02-23

"""
import json
from alembic import op
import sqlalchemy as sa

revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None

# Azure DevOps–style options per workflow id (must match seed.py).
WORKFLOW_OPTIONS = {
    "basic": {
        "state_reason_options": [
            {"id": "", "label": "— None —"},
            {"id": "new_defect_reported", "label": "New defect reported"},
            {"id": "build_failure", "label": "Build failure"},
            {"id": "work_started", "label": "Work started"},
            {"id": "code_complete", "label": "Code complete"},
            {"id": "work_finished", "label": "Work finished"},
            {"id": "accepted", "label": "Accepted"},
            {"id": "deferred", "label": "Deferred"},
        ],
        "resolution_options": [
            {"id": "", "label": "— None —"},
            {"id": "fixed", "label": "Fixed"},
            {"id": "fixed_and_verified", "label": "Fixed and verified"},
            {"id": "wont_fix", "label": "Won't fix"},
            {"id": "duplicate", "label": "Duplicate"},
            {"id": "as_designed", "label": "As designed"},
            {"id": "not_a_bug", "label": "Not a bug"},
        ],
    },
    "scrum": {
        "state_reason_options": [
            {"id": "", "label": "— None —"},
            {"id": "new_backlog_item", "label": "New backlog item"},
            {"id": "approved", "label": "Approved by Product Owner"},
            {"id": "commitment_made", "label": "Commitment made by the team"},
            {"id": "work_stopped", "label": "Work stopped"},
            {"id": "work_finished", "label": "Work finished"},
        ],
        "resolution_options": [
            {"id": "", "label": "— None —"},
            {"id": "fixed", "label": "Fixed"},
            {"id": "fixed_and_verified", "label": "Fixed and verified"},
            {"id": "wont_fix", "label": "Won't fix"},
            {"id": "duplicate", "label": "Duplicate"},
            {"id": "as_designed", "label": "As designed"},
            {"id": "not_a_bug", "label": "Not a bug"},
        ],
    },
    "kanban": {
        "state_reason_options": [
            {"id": "", "label": "— None —"},
            {"id": "new_item", "label": "New item"},
            {"id": "ready_for_work", "label": "Ready for work"},
            {"id": "work_started", "label": "Work started"},
            {"id": "work_finished", "label": "Work finished"},
        ],
        "resolution_options": [
            {"id": "", "label": "— None —"},
            {"id": "fixed", "label": "Fixed"},
            {"id": "fixed_and_verified", "label": "Fixed and verified"},
            {"id": "wont_fix", "label": "Won't fix"},
            {"id": "duplicate", "label": "Duplicate"},
            {"id": "as_designed", "label": "As designed"},
        ],
    },
}


def upgrade() -> None:
    conn = op.get_bind()
    result = conn.execute(
        sa.text("SELECT id, manifest_bundle FROM process_template_versions")
    )
    rows = result.fetchall()

    for (version_id, manifest_bundle) in rows:
        if not manifest_bundle:
            continue
        if isinstance(manifest_bundle, str):
            try:
                manifest_bundle = json.loads(manifest_bundle)
            except (TypeError, ValueError):
                continue
        if not isinstance(manifest_bundle, dict):
            continue
        defs = manifest_bundle.get("defs")
        if not defs or not isinstance(defs, list):
            continue
        changed = False
        new_defs = []
        for d in defs:
            if not isinstance(d, dict) or d.get("kind") != "Workflow":
                new_defs.append(d)
                continue
            wf_id = d.get("id") or ""
            opts = WORKFLOW_OPTIONS.get(wf_id) or WORKFLOW_OPTIONS.get("basic")
            new_d = dict(d)
            if not new_d.get("state_reason_options") and opts.get("state_reason_options"):
                new_d["state_reason_options"] = opts["state_reason_options"]
                changed = True
            if not new_d.get("resolution_options") and opts.get("resolution_options"):
                new_d["resolution_options"] = opts["resolution_options"]
                changed = True
            new_defs.append(new_d)
        if not changed:
            continue
        new_bundle = {**manifest_bundle, "defs": new_defs}
        conn.execute(
            sa.text(
                "UPDATE process_template_versions SET manifest_bundle = CAST(:bundle AS jsonb) WHERE id = :id"
            ),
            {"bundle": json.dumps(new_bundle), "id": str(version_id)},
        )


def downgrade() -> None:
    # Remove state_reason_options and resolution_options from workflow defs.
    conn = op.get_bind()
    result = conn.execute(
        sa.text("SELECT id, manifest_bundle FROM process_template_versions")
    )
    rows = result.fetchall()

    for (version_id, manifest_bundle) in rows:
        if not manifest_bundle:
            continue
        if isinstance(manifest_bundle, str):
            try:
                manifest_bundle = json.loads(manifest_bundle)
            except (TypeError, ValueError):
                continue
        if not isinstance(manifest_bundle, dict):
            continue
        defs = manifest_bundle.get("defs")
        if not defs or not isinstance(defs, list):
            continue
        changed = False
        new_defs = []
        for d in defs:
            if not isinstance(d, dict) or d.get("kind") != "Workflow":
                new_defs.append(d)
                continue
            new_d = {
                k: v for k, v in d.items()
                if k not in ("state_reason_options", "resolution_options")
            }
            if len(new_d) != len(d):
                changed = True
            new_defs.append(new_d)
        if not changed:
            continue
        new_bundle = {**manifest_bundle, "defs": new_defs}
        conn.execute(
            sa.text(
                "UPDATE process_template_versions SET manifest_bundle = CAST(:bundle AS jsonb) WHERE id = :id"
            ),
            {"bundle": json.dumps(new_bundle), "id": str(version_id)},
        )

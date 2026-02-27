"""Set target_date field type from 'string' to 'date' in all manifest_bundles.

Revision ID: 031
Revises: 030
Create Date: 2026-02-27

"""
import json
from alembic import op
import sqlalchemy as sa

revision = "031"
down_revision = "030"
branch_labels = None
depends_on = None


def _normalize_target_date_in_bundle(bundle: dict) -> bool:
    """Mutate bundle: set any field with id 'target_date' to type 'date'. Return True if changed."""
    changed = False

    def fix_fields(fields: list | None) -> None:
        nonlocal changed
        if not fields or not isinstance(fields, list):
            return
        for f in fields:
            if isinstance(f, dict) and f.get("id") == "target_date" and f.get("type") == "string":
                f["type"] = "date"
                changed = True

    for item in bundle.get("defs") or []:
        if isinstance(item, dict):
            fix_fields(item.get("fields"))
    for item in bundle.get("artifact_types") or []:
        if isinstance(item, dict):
            fix_fields(item.get("fields"))

    return changed


def upgrade() -> None:
    conn = op.get_bind()
    result = conn.execute(sa.text("SELECT id, manifest_bundle FROM process_template_versions"))
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
        if not _normalize_target_date_in_bundle(manifest_bundle):
            continue
        conn.execute(
            sa.text(
                "UPDATE process_template_versions SET manifest_bundle = CAST(:bundle AS jsonb) WHERE id = :id"
            ),
            {"bundle": json.dumps(manifest_bundle), "id": str(version_id)},
        )


def downgrade() -> None:
    # Reverting date -> string is possible but not required for correctness; leave as date.
    pass

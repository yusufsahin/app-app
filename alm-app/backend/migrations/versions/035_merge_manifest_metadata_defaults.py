"""Merge manifest metadata defaults into process_template_versions (tree_roots, task workflow, resolution hints).

Revision ID: 035
Revises: 034
Create Date: 2026-03-23
"""
import json
from alembic import op
import sqlalchemy as sa

from alm.artifact.domain.manifest_merge_defaults import merge_manifest_metadata_defaults

revision = "035"
down_revision = "034"
branch_labels = None
depends_on = None


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
        merged = merge_manifest_metadata_defaults(manifest_bundle)
        if merged == manifest_bundle:
            continue
        conn.execute(
            sa.text(
                "UPDATE process_template_versions SET manifest_bundle = CAST(:bundle AS jsonb) WHERE id = :id"
            ),
            {"bundle": json.dumps(merged), "id": str(version_id)},
        )


def downgrade() -> None:
    # Non-reversible merge; leave bundles as-is.
    pass

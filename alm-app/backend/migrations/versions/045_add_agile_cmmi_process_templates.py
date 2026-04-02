"""Add built-in Agile and CMMI process templates (idempotent by slug).

Revision ID: 045
Revises: 044
Create Date: 2026-04-02
"""

from __future__ import annotations

import json
import uuid

from alembic import op
import sqlalchemy as sa

from alm.artifact.domain.quality_manifest_extension import with_quality_manifest_bundle
from alm.config.seed import _BUILTIN_MANIFEST_CORE_AGILE, _BUILTIN_MANIFEST_CORE_CMMI

revision = "045"
down_revision = "044"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    specs: list[tuple[str, dict, str, str, str]] = [
        (
            "agile",
            _BUILTIN_MANIFEST_CORE_AGILE,
            "Agile",
            "Azure DevOps Agile: Epic, Feature, User story, Work item. "
            "Sprint tasks are ALM Task entities (artifact-linked), not manifest artifact types.",
            "agile",
        ),
        (
            "cmmi",
            _BUILTIN_MANIFEST_CORE_CMMI,
            "CMMI",
            "CMMI-style: Epic, Feature, Requirement; change request, risk, review, work item. "
            "Iteration tasks and effort are ALM Task entities, not work item types here.",
            "cmmi",
        ),
    ]
    for slug, core, name, description, ptype in specs:
        row = conn.execute(
            sa.text("SELECT id FROM process_templates WHERE slug = :slug"),
            {"slug": slug},
        ).fetchone()
        if row is not None:
            continue
        tid = uuid.uuid4()
        vid = uuid.uuid4()
        bundle = with_quality_manifest_bundle(core)
        conn.execute(
            sa.text(
                """
                INSERT INTO process_templates (
                    id, slug, name, is_builtin, description, type, created_at, updated_at
                )
                VALUES (
                    :id, :slug, :name, true, :description, :ptype, NOW(), NOW()
                )
                """
            ),
            {
                "id": tid,
                "slug": slug,
                "name": name,
                "description": description,
                "ptype": ptype,
            },
        )
        conn.execute(
            sa.text(
                """
                INSERT INTO process_template_versions (
                    id, template_id, version, manifest_bundle, created_at, updated_at
                )
                VALUES (
                    :vid, :tid, '1.0.0', CAST(:bundle AS jsonb), NOW(), NOW()
                )
                """
            ),
            {"vid": vid, "tid": tid, "bundle": json.dumps(bundle)},
        )


def downgrade() -> None:
    conn = op.get_bind()
    for slug in ("cmmi", "agile"):
        row = conn.execute(
            sa.text("SELECT id FROM process_templates WHERE slug = :slug AND is_builtin = true"),
            {"slug": slug},
        ).fetchone()
        if row is None:
            continue
        tid = row[0]
        conn.execute(
            sa.text("DELETE FROM process_template_versions WHERE template_id = :tid"),
            {"tid": tid},
        )
        conn.execute(
            sa.text("DELETE FROM process_templates WHERE id = :tid"),
            {"tid": tid},
        )

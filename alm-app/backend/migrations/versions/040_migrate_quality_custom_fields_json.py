"""Migrate quality JSON custom fields to canonical shapes (steps, run metrics v1, param rows).

Revision ID: 040
Revises: 039
Create Date: 2026-03-30

- test_steps_json: legacy rows used `action` and omitted `kind`; calls may use snake_case keys.
  Normalized to `kind: step` with `name`, `id`, `description`, `expectedResult`, `status`, or
  `kind: call` with camelCase fields.
- run_metrics_json: legacy `{ passed, failed, blocked, ... }` summaries become `{ "v": 1, "results": [...] }`.
  Synthetic `testId` UUIDs preserve counts only (per-test history is not recoverable).
- test_params_json: row objects without a `values` map are wrapped as `{ "values": { ... } }`.
"""

from __future__ import annotations

import json

import sqlalchemy as sa
from alembic import op

from alm.artifact.infrastructure.quality_custom_fields_migration import (
    migrate_run_metrics_json,
    migrate_test_params_rows,
    migrate_test_steps_json,
)

revision = "040"
down_revision = "039"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            """
            SELECT id, custom_fields FROM artifacts
            WHERE custom_fields IS NOT NULL
              AND (
                custom_fields ? 'test_steps_json'
                OR custom_fields ? 'run_metrics_json'
                OR custom_fields ? 'test_params_json'
              )
            """
        )
    )
    rows = result.fetchall()

    for artifact_id, cf in rows:
        if not isinstance(cf, dict):
            continue
        cf = dict(cf)
        updated = False
        aid = str(artifact_id)

        if "test_steps_json" in cf:
            new_steps, ch = migrate_test_steps_json(cf.get("test_steps_json"))
            if ch and new_steps is not None:
                cf["test_steps_json"] = new_steps
                updated = True

        if "run_metrics_json" in cf:
            new_rm, ch = migrate_run_metrics_json(cf.get("run_metrics_json"), aid)
            if ch and new_rm is not None:
                cf["run_metrics_json"] = new_rm
                updated = True

        if "test_params_json" in cf:
            new_tp, ch = migrate_test_params_rows(cf.get("test_params_json"))
            if ch and new_tp is not None:
                cf["test_params_json"] = new_tp
                updated = True

        if updated:
            conn.execute(
                sa.text("UPDATE artifacts SET custom_fields = CAST(:cf AS jsonb) WHERE id = :id"),
                {"cf": json.dumps(cf, default=str), "id": aid},
            )


def downgrade() -> None:
    # Forward-only: synthetic run_metrics testIds and expanded step metadata cannot be reversed safely.
    pass

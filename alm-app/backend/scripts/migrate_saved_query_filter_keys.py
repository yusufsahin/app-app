#!/usr/bin/env -S uv run python
"""Migrate saved_queries.filter_params keys from legacy names to canonical names.

Usage:
  cd alm-app/backend
  uv run python scripts/migrate_saved_query_filter_keys.py --dry-run
  uv run python scripts/migrate_saved_query_filter_keys.py --write --report reports/saved_query_filter_key_migration.json

The script:
  - renames cycle_node_id -> cycle_id
  - renames release_cycle_node_id -> release_id
  - reports suspicious rows with empty/conflicting values or unexpected legacy remnants
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import uuid
from pathlib import Path
from typing import Any

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))


LEGACY_TO_NEW_KEYS = {
    "cycle_node_id": "cycle_id",
    "release_cycle_node_id": "release_id",
}


def _normalize_filter_params(filter_params: Any) -> tuple[dict[str, Any], list[str], bool]:
    suspicious: list[str] = []
    if not isinstance(filter_params, dict):
        return {}, ["filter_params is not an object"], False

    normalized = dict(filter_params)
    changed = False

    for legacy_key, new_key in LEGACY_TO_NEW_KEYS.items():
        legacy_present = legacy_key in normalized
        new_present = new_key in normalized
        legacy_value = normalized.get(legacy_key)
        new_value = normalized.get(new_key)

        if legacy_present and new_present and legacy_value != new_value:
            suspicious.append(f"conflicting values for {legacy_key} and {new_key}")

        if legacy_present:
            if not new_present:
                normalized[new_key] = legacy_value
                changed = True
            del normalized[legacy_key]
            changed = True

        if new_key in normalized and (normalized[new_key] is None or str(normalized[new_key]).strip() == ""):
            suspicious.append(f"{new_key} is empty after migration")

    remaining_legacy = [key for key in normalized if key in LEGACY_TO_NEW_KEYS]
    if remaining_legacy:
        suspicious.append(f"legacy keys remain: {', '.join(remaining_legacy)}")

    return normalized, suspicious, changed


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true", help="Persist migrated filter_params back to the database")
    parser.add_argument("--dry-run", action="store_true", help="Analyze only without writing changes")
    parser.add_argument(
        "--report",
        type=str,
        default="reports/saved_query_filter_key_migration.json",
        help="Path to write the migration report JSON",
    )
    args = parser.parse_args()

    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import create_async_engine

    from alm.config.settings import settings

    write_changes = args.write and not args.dry_run
    engine = create_async_engine(settings.database_url, echo=False)

    report: dict[str, Any] = {
        "updated_count": 0,
        "unchanged_count": 0,
        "suspicious_count": 0,
        "suspicious_rows": [],
    }

    async with engine.begin() as conn:
        rows = (
            await conn.execute(
                text("SELECT id, project_id, name, filter_params FROM saved_queries ORDER BY created_at ASC")
            )
        ).mappings()

        for row in rows:
            row_id = row["id"]
            filter_params = row["filter_params"] or {}
            normalized, suspicious, changed = _normalize_filter_params(filter_params)

            if changed and write_changes:
                await conn.execute(
                    text("UPDATE saved_queries SET filter_params = CAST(:filter_params AS jsonb) WHERE id = :id"),
                    {
                        "id": row_id,
                        "filter_params": json.dumps(normalized),
                    },
                )

            if changed:
                report["updated_count"] += 1
            else:
                report["unchanged_count"] += 1

            if suspicious:
                report["suspicious_count"] += 1
                report["suspicious_rows"].append(
                    {
                        "id": str(row_id if isinstance(row_id, uuid.UUID) else row_id),
                        "project_id": str(row["project_id"]),
                        "name": row["name"],
                        "issues": suspicious,
                        "before": filter_params,
                        "after": normalized,
                    }
                )

    await engine.dispose()

    report_path = Path(args.report)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    mode = "write" if write_changes else "dry-run"
    print(f"Saved query filter key migration completed in {mode} mode.")
    print(json.dumps({k: v for k, v in report.items() if k != 'suspicious_rows'}, indent=2))
    print(f"Report written to {report_path}")


if __name__ == "__main__":
    asyncio.run(main())

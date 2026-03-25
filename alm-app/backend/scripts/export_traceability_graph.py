"""Export artifact_links rows to governance traceability YAML (catalog artifact_id strings).

Maps each DB artifact row via custom_fields.governance_artifact_id (required for export).
Writes YAML suitable for manual merge into alm_meta/traceability_graph.yaml after review.

Usage:
  cd alm-app/backend
  uv run python scripts/export_traceability_graph.py --output artifacts/traceability_graph.exported.yaml

Requires ALM_DATABASE_URL (or settings) and a running database with data.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path
from typing import Any
from uuid import UUID

import yaml

BACKEND_ROOT = Path(__file__).resolve().parent.parent


def _governance_id(custom_fields: Any) -> str | None:
    if not isinstance(custom_fields, dict):
        return None
    raw = custom_fields.get("governance_artifact_id")
    if isinstance(raw, str) and raw.strip():
        return raw.strip()
    return None


async def _export(project_id: str | None, output: Path) -> int:
    sys.path.insert(0, str(BACKEND_ROOT / "src"))

    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import create_async_engine

    from alm.config.settings import settings

    db_url = os.environ.get("ALM_DATABASE_URL") or settings.database_url
    engine = create_async_engine(db_url, echo=False)

    params: dict[str, Any] = {}
    proj_filter = ""
    if project_id:
        proj_filter = " AND al.project_id = :project_id"
        params["project_id"] = UUID(project_id)

    sql = text(
        f"""
        SELECT al.link_type,
               fa.custom_fields AS from_cf,
               ta.custom_fields AS to_cf
        FROM artifact_links al
        JOIN artifacts fa ON fa.id = al.from_artifact_id
        JOIN artifacts ta ON ta.id = al.to_artifact_id
        WHERE fa.deleted_at IS NULL
          AND ta.deleted_at IS NULL
          {proj_filter}
        """
    )

    links: list[dict[str, str]] = []
    skipped = 0

    async with engine.connect() as conn:
        result = await conn.execute(sql, params)
        rows = result.mappings().all()

    for row in rows:
        fid = _governance_id(row["from_cf"])
        tid = _governance_id(row["to_cf"])
        if not fid or not tid:
            skipped += 1
            continue
        lt = row["link_type"]
        if not isinstance(lt, str) or not lt.strip():
            skipped += 1
            continue
        links.append(
            {
                "from_artifact_id": fid,
                "to_artifact_id": tid,
                "link_type": lt.strip(),
            }
        )

    await engine.dispose()

    output.parent.mkdir(parents=True, exist_ok=True)
    header = (
        "# Exported from artifact_links; merge into alm_meta/traceability_graph.yaml after review.\n"
        "# Rows need custom_fields.governance_artifact_id on both endpoint artifacts.\n"
    )
    body = yaml.safe_dump({"links": links}, sort_keys=False, allow_unicode=True)
    output.write_text(header + body, encoding="utf-8")

    print(f"[export_traceability_graph] wrote {len(links)} link(s) to {output}", flush=True)
    if skipped:
        print(
            f"[export_traceability_graph] skipped {skipped} row(s) (missing governance_artifact_id or link_type)",
            flush=True,
        )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Export DB artifact_links to traceability_graph YAML")
    parser.add_argument(
        "--output",
        default="artifacts/traceability_graph.exported.yaml",
        help="Output path (default: artifacts/traceability_graph.exported.yaml)",
    )
    parser.add_argument(
        "--project-id",
        default=None,
        help="Optional UUID: limit links to one project",
    )
    args = parser.parse_args()
    out_path = Path(args.output)
    if not out_path.is_absolute():
        out_path = BACKEND_ROOT / out_path
    return asyncio.run(_export(args.project_id, out_path))


if __name__ == "__main__":
    raise SystemExit(main())

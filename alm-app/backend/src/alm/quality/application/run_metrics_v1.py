"""Parse test-run ``run_metrics_json`` v1 document (aligned with frontend runMetrics.ts)."""

from __future__ import annotations

import json
import uuid
from typing import Any

RUN_METRICS_VERSION = 1

_VALID_STATUS = frozenset({"passed", "failed", "blocked", "not-executed"})


def parse_run_metrics_v1_results(custom_fields: dict[str, Any] | None) -> list[dict[str, Any]]:
    """Return ``results`` rows from v1 document, or empty list if missing/invalid."""
    if not custom_fields:
        return []
    raw = custom_fields.get("run_metrics_json")
    if raw is None:
        return []
    if isinstance(raw, str) and raw.strip():
        try:
            doc = json.loads(raw)
        except (TypeError, ValueError):
            return []
    elif isinstance(raw, dict):
        doc = raw
    else:
        return []
    if doc.get("v") != RUN_METRICS_VERSION:
        return []
    results = doc.get("results")
    if not isinstance(results, list):
        return []
    return [r for r in results if isinstance(r, dict)]


def metrics_row_for_test_id(
    custom_fields: dict[str, Any] | None, test_id: uuid.UUID
) -> dict[str, Any] | None:
    """First result row whose ``testId`` string matches ``test_id``."""
    tid = str(test_id)
    for row in parse_run_metrics_v1_results(custom_fields):
        if str(row.get("testId") or "") == tid:
            return row
    return None


def normalize_execution_status(raw: Any) -> str | None:
    if not isinstance(raw, str):
        return None
    s = raw.strip()
    return s if s in _VALID_STATUS else None


def step_statuses_from_metrics_row(row: dict[str, Any]) -> list[tuple[str, str]]:
    """Pairs ``(step_id, status)`` from ``stepResults`` (execution player shape)."""
    out: list[tuple[str, str]] = []
    sr = row.get("stepResults")
    if not isinstance(sr, list):
        return out
    for item in sr:
        if not isinstance(item, dict):
            continue
        sid = str(item.get("stepId") or "").strip()
        if not sid:
            continue
        st = normalize_execution_status(item.get("status")) or "not-executed"
        out.append((sid, st))
    return out

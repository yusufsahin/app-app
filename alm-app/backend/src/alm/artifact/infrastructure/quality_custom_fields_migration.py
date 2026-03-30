"""Data migration helpers: canonical quality JSON in artifact custom_fields.

Used by Alembic revision 040. See migration docstring for semantics."""

from __future__ import annotations

import json
import uuid
from typing import Any


def _intish(x: Any) -> int:
    if x is None:
        return 0
    if isinstance(x, bool):
        return int(x)
    if isinstance(x, int):
        return x
    if isinstance(x, float):
        return int(x)
    if isinstance(x, str):
        try:
            return int(float(x.strip()))
        except ValueError:
            return 0
    return 0


def _norm_step_status(raw: Any) -> str:
    if raw in ("passed", "failed", "blocked", "not-executed"):
        return raw
    return "not-executed"


def _parse_json_list(raw: Any) -> list[Any] | None:
    if raw is None:
        return None
    if isinstance(raw, list):
        return raw
    if isinstance(raw, str) and raw.strip():
        try:
            v = json.loads(raw)
        except (TypeError, ValueError):
            return None
        return v if isinstance(v, list) else None
    return None


def migrate_test_steps_json(raw: Any) -> tuple[list[Any] | None, bool]:
    """Return (new_list, changed). new_list None means leave DB value unchanged."""
    items = _parse_json_list(raw)
    if items is None:
        return None, False

    changed = False
    out: list[dict[str, Any]] = []

    for item in items:
        if not isinstance(item, dict):
            changed = True
            continue

        kind = item.get("kind")
        if kind == "call":
            cid = item.get("calledTestCaseId") or item.get("called_test_case_id")
            cid = cid.strip() if isinstance(cid, str) else ""
            if not cid:
                changed = True
                continue
            row: dict[str, Any] = {
                "kind": "call",
                "id": item["id"].strip()
                if isinstance(item.get("id"), str) and item["id"].strip()
                else f"call-{len(out) + 1}",
                "stepNumber": item["stepNumber"] if isinstance(item.get("stepNumber"), int) else len(out) + 1,
                "calledTestCaseId": cid,
            }
            ct = item.get("calledTitle") or item.get("called_title")
            if isinstance(ct, str) and ct.strip():
                row["calledTitle"] = ct.strip()
            po = item.get("paramOverrides") or item.get("param_overrides")
            if isinstance(po, dict) and po:
                row["paramOverrides"] = {
                    str(k): "" if v is None else str(v) for k, v in po.items()
                }
            if item.get("called_test_case_id") or item.get("called_title") or item.get("param_overrides"):
                changed = True
            out.append(row)
            continue

        if kind == "step":
            name = item.get("name") if isinstance(item.get("name"), str) else ""
            name = name.strip()
            if not name:
                changed = True
                continue
            er = item.get("expectedResult") if isinstance(item.get("expectedResult"), str) else ""
            if not er and isinstance(item.get("expected_result"), str):
                er = item["expected_result"]
                changed = True
            desc = item.get("description") if isinstance(item.get("description"), str) else ""
            step = {
                "kind": "step",
                "id": item["id"].strip()
                if isinstance(item.get("id"), str) and item["id"].strip()
                else f"step-{len(out) + 1}",
                "stepNumber": item["stepNumber"] if isinstance(item.get("stepNumber"), int) else len(out) + 1,
                "name": name,
                "description": desc,
                "expectedResult": er,
                "status": _norm_step_status(item.get("status")),
            }
            if isinstance(item.get("actualResult"), str):
                step["actualResult"] = item["actualResult"]
            if isinstance(item.get("notes"), str):
                step["notes"] = item["notes"]
            out.append(step)
            continue

        name = ""
        if isinstance(item.get("name"), str):
            name = item["name"].strip()
        if not name and isinstance(item.get("action"), str):
            name = item["action"].strip()
        if not name:
            changed = True
            continue
        er = ""
        if isinstance(item.get("expectedResult"), str):
            er = item["expectedResult"]
        elif isinstance(item.get("expected_result"), str):
            er = item["expected_result"]
        desc = item.get("description") if isinstance(item.get("description"), str) else ""
        out.append(
            {
                "kind": "step",
                "id": item["id"].strip()
                if isinstance(item.get("id"), str) and item["id"].strip()
                else f"step-{len(out) + 1}",
                "stepNumber": item["stepNumber"] if isinstance(item.get("stepNumber"), int) else len(out) + 1,
                "name": name,
                "description": desc,
                "expectedResult": er,
                "status": _norm_step_status(item.get("status")),
            }
        )
        changed = True

    for idx, row in enumerate(out):
        want = idx + 1
        if row.get("stepNumber") != want:
            row["stepNumber"] = want
            changed = True

    if not changed and json.dumps(items, sort_keys=True, default=str) != json.dumps(
        out, sort_keys=True, default=str
    ):
        changed = True

    return out, changed


def migrate_run_metrics_json(raw: Any, _artifact_id: str) -> tuple[dict[str, Any] | None, bool]:
    """Return (new_doc, changed). None = skip update."""
    if raw is None:
        return None, False
    if isinstance(raw, str) and raw.strip():
        try:
            doc = json.loads(raw)
        except (TypeError, ValueError):
            return None, False
    elif isinstance(raw, dict):
        doc = dict(raw)
    else:
        return None, False

    if doc.get("v") == 1 and isinstance(doc.get("results"), list):
        return None, False

    if not any(k in doc for k in ("passed", "failed", "blocked", "notExecuted", "not_executed")):
        return None, False

    p = _intish(doc.get("passed"))
    f = _intish(doc.get("failed"))
    b = _intish(doc.get("blocked"))
    ne = _intish(doc.get("notExecuted") or doc.get("not_executed"))

    results: list[dict[str, Any]] = []
    for _ in range(p):
        results.append({"testId": str(uuid.uuid4()), "status": "passed", "stepResults": []})
    for _ in range(f):
        results.append({"testId": str(uuid.uuid4()), "status": "failed", "stepResults": []})
    for _ in range(b):
        results.append({"testId": str(uuid.uuid4()), "status": "blocked", "stepResults": []})
    for _ in range(ne):
        results.append({"testId": str(uuid.uuid4()), "status": "not-executed", "stepResults": []})

    return {"v": 1, "results": results}, True


def migrate_test_params_rows(raw: Any) -> tuple[dict[str, Any] | None, bool]:
    if raw is None:
        return None, False
    if isinstance(raw, str) and raw.strip():
        try:
            doc = json.loads(raw)
        except (TypeError, ValueError):
            return None, False
    elif isinstance(raw, dict):
        doc = dict(raw)
    else:
        return None, False

    rows = doc.get("rows")
    if not isinstance(rows, list):
        return None, False

    changed = False
    new_rows: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            new_rows.append(row)
            continue
        if "values" in row and isinstance(row.get("values"), dict):
            new_rows.append(row)
            continue
        vals = {k: v for k, v in row.items() if k != "label"}
        if not vals:
            changed = True
            continue
        out_row: dict[str, Any] = {
            "values": {str(k): "" if v is None else str(v) for k, v in vals.items()}
        }
        if isinstance(row.get("label"), str) and row["label"].strip():
            out_row["label"] = row["label"].strip()
        new_rows.append(out_row)
        changed = True

    if not changed:
        return None, False
    out_doc = {**doc, "rows": new_rows}
    return out_doc, True

"""Validate and normalize `custom_fields.test_params_json` for quality test cases."""

from __future__ import annotations

import re
from typing import Any

_MAX_ROWS = 500
_NAME_RE = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")


def validate_and_normalize_test_params_json(raw: Any) -> dict[str, Any] | None:
    """Return normalized dict or None if empty after normalization. Raises ValueError on invalid shape."""
    if raw is None:
        return None
    if not isinstance(raw, dict):
        msg = "test_params_json must be an object"
        raise ValueError(msg)
    defs_raw = raw.get("defs")
    if not isinstance(defs_raw, list):
        msg = "test_params_json.defs must be an array"
        raise ValueError(msg)
    defs: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in defs_raw:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name", "")).strip()
        if not name or not _NAME_RE.match(name) or name in seen:
            continue
        seen.add(name)
        entry: dict[str, Any] = {"name": name}
        if isinstance(item.get("label"), str) and item["label"].strip():
            entry["label"] = item["label"].strip()
        if isinstance(item.get("default"), str):
            entry["default"] = item["default"]
        defs.append(entry)
    rows_out: list[dict[str, Any]] = []
    rows_raw = raw.get("rows")
    if rows_raw is not None:
        if not isinstance(rows_raw, list):
            msg = "test_params_json.rows must be an array"
            raise ValueError(msg)
        if len(rows_raw) > _MAX_ROWS:
            msg = f"test_params_json.rows exceeds max of {_MAX_ROWS}"
            raise ValueError(msg)
        def_names = {d["name"] for d in defs}
        for row in rows_raw:
            if not isinstance(row, dict):
                continue
            if "values" in row and isinstance(row.get("values"), dict):
                vals = {
                    str(k): "" if v is None else str(v) for k, v in row["values"].items()
                }
            else:
                vals = {
                    str(k): "" if v is None else str(v)
                    for k, v in row.items()
                    if k != "label"
                }
            vals = {k: v for k, v in vals.items() if k in def_names}
            out_row: dict[str, Any] = {"values": vals}
            if isinstance(row.get("label"), str) and row["label"].strip():
                out_row["label"] = row["label"].strip()
            rows_out.append(out_row)
    if not defs and not rows_out:
        return None
    if not defs and rows_out:
        msg = "test_params_json.defs cannot be empty when rows are present"
        raise ValueError(msg)
    out: dict[str, Any] = {"defs": defs}
    if rows_out:
        out["rows"] = rows_out
    return out

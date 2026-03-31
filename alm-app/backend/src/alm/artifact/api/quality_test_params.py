"""Validate and normalize `custom_fields.test_params_json` for quality test cases."""

from __future__ import annotations

import re
import uuid
from typing import Any

_MAX_ROWS = 500
_NAME_RE = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")
_VALID_PARAM_TYPES = frozenset({"string", "number", "boolean", "secret", "enum"})
_VALID_ROW_STATUS = frozenset({"active", "draft", "archived"})


def _coerce_string(value: Any, *, field_name: str) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, (bool, int, float)):
        return str(value)
    msg = f"{field_name} must be a string-compatible value"
    raise ValueError(msg)


def _normalize_param_defs(defs_raw: list[Any]) -> list[dict[str, Any]]:
    defs: list[dict[str, Any]] = []
    seen: set[str] = set()
    for index, item in enumerate(defs_raw):
        if not isinstance(item, dict):
            msg = f"test_params_json.defs[{index}] must be an object"
            raise ValueError(msg)
        name = str(item.get("name", "")).strip()
        if not name:
            msg = f"test_params_json.defs[{index}].name is required"
            raise ValueError(msg)
        if not _NAME_RE.match(name):
            msg = f"test_params_json.defs[{index}].name is invalid"
            raise ValueError(msg)
        if name in seen:
            msg = f"test_params_json.defs[{index}].name must be unique"
            raise ValueError(msg)
        seen.add(name)
        param_type = str(item.get("type") or "string").strip().lower() or "string"
        if param_type not in _VALID_PARAM_TYPES:
            msg = f"test_params_json.defs[{index}].type is invalid"
            raise ValueError(msg)
        entry: dict[str, Any] = {"name": name, "type": param_type}
        if isinstance(item.get("label"), str) and item["label"].strip():
            entry["label"] = item["label"].strip()
        if "default" in item and item.get("default") is not None:
            entry["default"] = _coerce_string(
                item.get("default"), field_name=f"test_params_json.defs[{index}].default"
            )
        if "required" in item:
            entry["required"] = bool(item.get("required"))
        allowed = item.get("allowedValues")
        if allowed is not None:
            if not isinstance(allowed, list):
                msg = f"test_params_json.defs[{index}].allowedValues must be an array"
                raise ValueError(msg)
            allowed_values = [
                _coerce_string(v, field_name=f"test_params_json.defs[{index}].allowedValues")
                for v in allowed
            ]
            entry["allowedValues"] = allowed_values
            if param_type == "enum" and not allowed_values:
                msg = f"test_params_json.defs[{index}].allowedValues cannot be empty for enum"
                raise ValueError(msg)
        elif param_type == "enum":
            msg = f"test_params_json.defs[{index}].allowedValues is required for enum"
            raise ValueError(msg)
        if (
            "default" in entry
            and "allowedValues" in entry
            and entry["default"] not in set(entry["allowedValues"])
        ):
            msg = f"test_params_json.defs[{index}].default must be one of allowedValues"
            raise ValueError(msg)
        defs.append(entry)
    return defs


def _normalize_row_values(
    row: dict[str, Any], *, index: int, def_by_name: dict[str, dict[str, Any]]
) -> dict[str, str]:
    values_raw = row.get("values", row)
    if not isinstance(values_raw, dict):
        msg = f"test_params_json.rows[{index}].values must be an object"
        raise ValueError(msg)
    values: dict[str, str] = {}
    for key, raw_value in values_raw.items():
        if key in {"id", "label", "name", "isDefault", "status", "tags"}:
            continue
        name = str(key).strip()
        if name not in def_by_name:
            msg = f"test_params_json.rows[{index}].values.{name} is not defined in defs"
            raise ValueError(msg)
        value = _coerce_string(
            raw_value, field_name=f"test_params_json.rows[{index}].values.{name}"
        )
        allowed_values = def_by_name[name].get("allowedValues")
        if isinstance(allowed_values, list) and value and value not in set(allowed_values):
            msg = f"test_params_json.rows[{index}].values.{name} must be one of allowedValues"
            raise ValueError(msg)
        values[name] = value
    return values


def _normalize_rows(rows_raw: list[Any], defs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if len(rows_raw) > _MAX_ROWS:
        msg = f"test_params_json.rows exceeds max of {_MAX_ROWS}"
        raise ValueError(msg)
    def_by_name = {str(d["name"]): d for d in defs}
    rows_out: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    seen_default = False
    for index, row in enumerate(rows_raw):
        if not isinstance(row, dict):
            msg = f"test_params_json.rows[{index}] must be an object"
            raise ValueError(msg)
        row_id = str(row.get("id") or "").strip() or str(uuid.uuid4())
        if row_id in seen_ids:
            msg = f"test_params_json.rows[{index}].id must be unique"
            raise ValueError(msg)
        seen_ids.add(row_id)
        out_row: dict[str, Any] = {"id": row_id}
        if isinstance(row.get("name"), str) and row["name"].strip():
            out_row["name"] = row["name"].strip()
        if isinstance(row.get("label"), str) and row["label"].strip():
            out_row["label"] = row["label"].strip()
        values = _normalize_row_values(row, index=index, def_by_name=def_by_name)
        for def_name, def_entry in def_by_name.items():
            if not def_entry.get("required"):
                continue
            default_value = def_entry.get("default")
            current_value = values.get(def_name, "")
            if current_value or default_value:
                continue
            msg = f"test_params_json.rows[{index}].values.{def_name} is required"
            raise ValueError(msg)
        out_row["values"] = values
        is_default = bool(row.get("isDefault", False))
        if is_default:
            if seen_default:
                msg = "test_params_json.rows can only have one default row"
                raise ValueError(msg)
            seen_default = True
            out_row["isDefault"] = True
        status = str(row.get("status") or "").strip().lower()
        if status:
            if status not in _VALID_ROW_STATUS:
                msg = f"test_params_json.rows[{index}].status is invalid"
                raise ValueError(msg)
            out_row["status"] = status
        tags = row.get("tags")
        if tags is not None:
            if not isinstance(tags, list):
                msg = f"test_params_json.rows[{index}].tags must be an array"
                raise ValueError(msg)
            out_row["tags"] = [
                str(tag).strip()
                for tag in tags
                if isinstance(tag, str) and tag.strip()
            ]
        rows_out.append(out_row)
    return rows_out


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
    defs = _normalize_param_defs(defs_raw)
    rows_raw = raw.get("rows")
    if rows_raw is not None:
        if not isinstance(rows_raw, list):
            msg = "test_params_json.rows must be an array"
            raise ValueError(msg)
        rows_out = _normalize_rows(rows_raw, defs)
    else:
        rows_out = []
    if not defs and not rows_out:
        return None
    if not defs and rows_out:
        msg = "test_params_json.defs cannot be empty when rows are present"
        raise ValueError(msg)
    out: dict[str, Any] = {"v": 2, "defs": defs}
    if rows_out:
        out["rows"] = rows_out
    return out

"""Safe guard evaluator for workflow transition guards.

Guards from the manifest must be evaluated without executing arbitrary code.
This module provides a whitelist-based predicate evaluator. Do not use eval() or
exec() on user/tenant-provided strings. See docs/GUARD_EVALUATOR_SECURITY.md.
"""
from __future__ import annotations

import re
from typing import Any

# Whitelist of top-level snapshot keys that guards may read
_ALLOWED_TOP_LEVEL_KEYS = frozenset({"assignee_id", "state", "state_reason", "resolution", "custom_fields"})
# Custom field keys must be alphanumeric + underscore only
_CUSTOM_FIELD_KEY_RE = re.compile(r"^[a-zA-Z0-9_]+$")


def _get_snapshot_value(entity_snapshot: dict, field: str) -> Any:
    """Read a field from snapshot. Only allows whitelisted top-level keys or custom_fields[key]."""
    if not field or not isinstance(entity_snapshot, dict):
        return None
    if field in _ALLOWED_TOP_LEVEL_KEYS:
        return entity_snapshot.get(field)
    if field.startswith("custom_fields."):
        key = field.split(".", 1)[1]
        if _CUSTOM_FIELD_KEY_RE.match(key):
            cf = entity_snapshot.get("custom_fields")
            if isinstance(cf, dict):
                return cf.get(key)
    return None


def evaluate_guard(
    guard_ref: str | dict[str, Any] | None,
    entity_snapshot: dict,
) -> bool:
    """Evaluate a guard referenced by guard_ref against the entity snapshot.

    Args:
        guard_ref: Identifier string (e.g. "assignee_required") or dict with
            "type" and optional params (e.g. {"type": "field_equals", "field": "state_reason", "value": "done"}).
        entity_snapshot: Domain-agnostic dict (e.g. artifact.to_snapshot_dict()).

    Returns:
        True if the guard passes, False otherwise.

    Supported guard types (whitelist only):
        - assignee_required: snapshot.assignee_id is truthy
        - field_present: snapshot[field] is truthy (field must be allowed)
        - field_equals: snapshot[field] == value (field must be allowed)

    Security: Only whitelisted predicates. No eval() or arbitrary code.
    """
    if not isinstance(entity_snapshot, dict):
        return False
    if guard_ref is None:
        return True
    if isinstance(guard_ref, str):
        guard_type = guard_ref.strip()
        params: dict[str, Any] = {}
    elif isinstance(guard_ref, dict) and guard_ref.get("type"):
        guard_type = str(guard_ref["type"]).strip()
        params = {k: v for k, v in guard_ref.items() if k != "type"}
    else:
        return False
    if not guard_type:
        return True

    if guard_type == "assignee_required":
        return bool(entity_snapshot.get("assignee_id"))

    if guard_type == "field_present":
        field = params.get("field")
        if not isinstance(field, str):
            return False
        return bool(_get_snapshot_value(entity_snapshot, field))

    if guard_type == "field_equals":
        field = params.get("field")
        value = params.get("value")
        if not isinstance(field, str):
            return False
        actual = _get_snapshot_value(entity_snapshot, field)
        return actual == value

    # Unknown guard type: fail closed (do not allow transition)
    return False

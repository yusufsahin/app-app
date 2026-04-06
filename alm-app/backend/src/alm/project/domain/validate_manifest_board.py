"""Lightweight validation for optional manifest `board` metadata."""

from __future__ import annotations

from typing import Any

from alm.shared.domain.exceptions import ValidationError

_VALID_COLUMN_SOURCES = frozenset({"workflow_states", "state_category"})


def _normalize_state_key(s: str) -> str:
    return (s or "").strip().lower()


def _collect_workflow_state_ids(bundle: dict[str, Any]) -> set[str]:
    ids: set[str] = set()
    for wf in bundle.get("workflows") or []:
        if not isinstance(wf, dict):
            continue
        for entry in wf.get("states") or []:
            if isinstance(entry, str) and entry.strip():
                ids.add(_normalize_state_key(entry))
            elif isinstance(entry, dict):
                sid = entry.get("id")
                if isinstance(sid, str) and sid.strip():
                    ids.add(_normalize_state_key(sid))
    return ids


def _collect_workflow_categories(bundle: dict[str, Any]) -> set[str]:
    """Categories referenced in workflows; string-only states count as `proposed` (matches frontend infer)."""
    cats: set[str] = set()
    for wf in bundle.get("workflows") or []:
        if not isinstance(wf, dict):
            continue
        for entry in wf.get("states") or []:
            if isinstance(entry, str) and entry.strip():
                cats.add("proposed")
            elif isinstance(entry, dict):
                c = entry.get("category")
                if isinstance(c, str) and c.strip():
                    cats.add(_normalize_state_key(c))
                else:
                    cats.add("proposed")
    return cats


def validate_manifest_board_section(bundle: dict[str, Any]) -> None:
    """Raise ValidationError if `board` block is present but invalid."""
    board = bundle.get("board")
    if board is None:
        return
    if not isinstance(board, dict):
        raise ValidationError("board must be an object when present")

    surfaces = board.get("surfaces")
    if surfaces is None:
        return
    if not isinstance(surfaces, dict):
        raise ValidationError("board.surfaces must be an object when present")

    default = surfaces.get("default")
    if default is None:
        return
    if not isinstance(default, dict):
        raise ValidationError("board.surfaces.default must be an object when present")

    cs = default.get("column_source")
    if cs is not None and cs not in _VALID_COLUMN_SOURCES:
        raise ValidationError(
            "board.surfaces.default.column_source must be one of: workflow_states, state_category",
        )

    state_ids = _collect_workflow_state_ids(bundle)
    categories = _collect_workflow_categories(bundle)

    for hid in default.get("hide_state_ids") or []:
        if not isinstance(hid, str) or not hid.strip():
            raise ValidationError("board.surfaces.default.hide_state_ids entries must be non-empty strings")
        if state_ids and _normalize_state_key(hid) not in state_ids:
            raise ValidationError(f"board.surfaces.default.hide_state_ids: unknown workflow state {hid!r}")

    column_source = cs if isinstance(cs, str) else "workflow_states"
    for raw in default.get("column_order_override") or []:
        if not isinstance(raw, str) or not raw.strip():
            raise ValidationError("board.surfaces.default.column_order_override entries must be non-empty strings")
        key = _normalize_state_key(raw)
        if column_source == "workflow_states":
            if state_ids and key not in state_ids:
                raise ValidationError(
                    f"board.surfaces.default.column_order_override: unknown workflow state {raw!r}",
                )
        elif column_source == "state_category" and categories and key not in categories:
            raise ValidationError(
                f"board.surfaces.default.column_order_override: unknown state category {raw!r}",
            )

    for k in default.get("card_fields") or []:
        if not isinstance(k, str) or not k.strip():
            raise ValidationError("board.surfaces.default.card_fields entries must be non-empty strings")

    gb = default.get("group_by")
    if gb is not None and (not isinstance(gb, str) or not gb.strip()):
        raise ValidationError("board.surfaces.default.group_by must be a non-empty string when present")

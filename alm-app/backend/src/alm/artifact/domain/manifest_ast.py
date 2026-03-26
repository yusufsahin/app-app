"""Minimal manifest AST when MPC is absent; shared def lookup helpers."""

from __future__ import annotations

from typing import Any


class DefNode:
    """Minimal def node: kind, id, properties (dict)."""

    __slots__ = ("kind", "id", "properties")

    def __init__(self, d: dict[str, Any]) -> None:
        self.kind = d.get("kind", "")
        self.id = str(d.get("id", ""))
        self.properties = {k: v for k, v in d.items() if k not in ("kind", "id")}


class SimpleAST:
    def __init__(self, manifest_bundle: dict[str, Any]) -> None:
        self.defs = [DefNode(d) for d in manifest_bundle.get("defs", []) if isinstance(d, dict)]


def to_ast_fallback(manifest_bundle: dict[str, Any]) -> SimpleAST:
    return SimpleAST(manifest_bundle or {})


def get_def(ast: Any, kind: str, def_id: str) -> Any | None:
    for d in ast.defs:
        if d.kind == kind and d.id == def_id:
            return d
    return None


def get_defs_by_kind(ast: Any, kind: str) -> list[Any]:
    return [d for d in ast.defs if d.kind == kind]


# Legacy names used by workflow_sm and tests
_to_ast_fallback = to_ast_fallback
_get_def = get_def
_get_defs_by_kind = get_defs_by_kind

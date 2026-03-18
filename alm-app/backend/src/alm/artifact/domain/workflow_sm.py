"""Statelesspy-based workflow adapter: single source for state graph and permitted transitions.

This module is the only place that decides valid (from_state, to_state) transitions and
permitted triggers. MPC remains responsible for policy/ACL (who may transition, event-based rules).
See docs/WORKFLOW_ENGINE_BOUNDARY.md for the boundary diagram.
"""

from __future__ import annotations

from typing import Any

from alm.artifact.domain.mpc_resolver import (
    TYPE_KIND_ARTIFACT,
    _get_def,
    _to_ast_fallback,
)

try:
    from mpc.features.workflow import WorkflowEngine, WorkflowSpec
    from mpc.features.expr import ExprEngine
    from mpc.kernel.ast import ManifestAST
    from mpc.kernel.meta import DomainMeta
    _HAS_MPC = True
except ImportError:
    _HAS_MPC = False
    WorkflowEngine = Any  # type: ignore[misc, assignment]
    ExprEngine = Any  # type: ignore[misc, assignment]




def get_workflow_engine(
    manifest_bundle: dict[str, Any],
    type_id: str,
    *,
    type_kind: str = TYPE_KIND_ARTIFACT,
    ast: Any | None = None,
) -> WorkflowEngine | None:
    """Build a native MPC WorkflowEngine for the given artifact type."""
    if not _HAS_MPC:
        return None

    wf_def = get_workflow_def(manifest_bundle, type_id, type_kind=type_kind, ast=ast)
    if not wf_def:
        return None

    try:
        expr_engine = ExprEngine(meta=DomainMeta())
    except TypeError:
        expr_engine = ExprEngine()
    engine = WorkflowEngine.from_fixture_input(
        wf_def,
        expr_engine=expr_engine,
    )
    return engine


def _workflow_def_from_defs(manifest_bundle: dict[str, Any], type_id: str, ast: Any) -> dict[str, Any] | None:
    """Resolve workflow definition from manifest defs format using AST."""
    at_def = _get_def(ast, TYPE_KIND_ARTIFACT, type_id)
    if at_def is None:
        return None
    workflow_id = at_def.properties.get("workflow_id")
    if not workflow_id:
        return None
    wf_def = _get_def(ast, "Workflow", workflow_id)
    if wf_def is None:
        return None
    return {
        "states": wf_def.properties.get("states") or [],
        "transitions": wf_def.properties.get("transitions") or [],
        "initial": wf_def.properties.get("initial"),
    }


def get_workflow_def(
    manifest_bundle: dict[str, Any],
    type_id: str,
    *,
    type_kind: str = TYPE_KIND_ARTIFACT,
    ast: Any | None = None,
) -> dict[str, Any] | None:
    """Get workflow definition (states, transitions, initial) for the given artifact type."""
    if ast is None:
        if not (manifest_bundle or {}).get("defs"):
            return None
        ast = _to_ast_fallback(manifest_bundle)
    return _workflow_def_from_defs(manifest_bundle, type_id, ast)


def get_initial_state(
    manifest_bundle: dict[str, Any],
    type_id: str,
    *,
    type_kind: str = TYPE_KIND_ARTIFACT,
    ast: Any | None = None,
) -> str | None:
    """Return initial state for the artifact type's workflow."""
    engine = get_workflow_engine(manifest_bundle, type_id, type_kind=type_kind, ast=ast)
    if not engine:
        return None
    return engine.initial_state


def is_valid_transition(
    manifest_bundle: dict[str, Any],
    type_id: str,
    from_state: str,
    to_state: str,
    *,
    type_kind: str = TYPE_KIND_ARTIFACT,
    ast: Any | None = None,
) -> bool:
    """Return True if (from_state, to_state) is allowed by the workflow."""
    engine = get_workflow_engine(manifest_bundle, type_id, type_kind=type_kind, ast=ast)
    if not engine:
        return False
    if hasattr(engine, "is_valid_transition"):
        return engine.is_valid_transition(from_state, to_state)
    # Direct fallback for engine variations
    return any(
        t.from_state == from_state and t.to_state == to_state
        for t in getattr(engine, "transitions", [])
    )


def get_transition_actions(
    manifest_bundle: dict[str, Any],
    type_id: str,
    from_state: str,
    to_state: str,
    *,
    type_kind: str = TYPE_KIND_ARTIFACT,
    ast: Any | None = None,
) -> dict[str, list[str]]:
    """Return on_leave and on_enter action names for the transition (from manifest)."""
    engine = get_workflow_engine(manifest_bundle, type_id, type_kind=type_kind, ast=ast)
    if not engine:
        return {"on_leave": [], "on_enter": []}
    return engine.get_transition_actions(from_state, to_state)


def get_transition_guard(
    manifest_bundle: dict[str, Any],
    type_id: str,
    from_state: str,
    to_state: str,
    *,
    type_kind: str = TYPE_KIND_ARTIFACT,
    ast: Any | None = None,
) -> Any:
    """Return the guard value for the transition (from, to) or None if no guard."""
    wf_def = get_workflow_def(manifest_bundle, type_id, type_kind=type_kind, ast=ast)
    if not wf_def:
        return None
    # This helper was removed, so we need to re-implement the logic here
    transitions = wf_def.get("transitions") or []
    for t in transitions:
        if not isinstance(t, dict) or "from" not in t or "to" not in t:
            continue
        fr, to = str(t.get("from", "")), str(t.get("to", ""))
        if fr == from_state and to == to_state:
            return t.get("guard")
    return None


def get_permitted_triggers(
    manifest_bundle: dict[str, Any],
    type_id: str,
    current_state: str,
    *,
    type_kind: str = TYPE_KIND_ARTIFACT,
    ast: Any | None = None,
    entity_snapshot: dict[str, Any] | None = None,
) -> list[tuple[str, str, str]]:
    """Return list of (trigger, to_state, label) permitted from current_state."""
    engine = get_workflow_engine(manifest_bundle, type_id, type_kind=type_kind, ast=ast)
    if not engine:
        return []
    
    engine.active_states = {current_state}
    available = engine.available_transitions()
    
    result: list[tuple[str, str, str]] = []
    for tr in available:
        # MPC Transition object has 'on', 'to_state', and we use to_state as label by default
        result.append((tr.on, tr.to_state, tr.to_state))
    return result

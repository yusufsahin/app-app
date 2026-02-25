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


def _workflow_def_from_defs(manifest_bundle: dict, type_id: str, ast: Any) -> dict | None:
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


def _workflow_def_from_flat(manifest_bundle: dict, type_id: str) -> dict | None:
    """Resolve workflow definition from flat workflows/artifact_types format."""
    artifact_types = (manifest_bundle or {}).get("artifact_types") or []
    at = next((a for a in artifact_types if isinstance(a, dict) and a.get("id") == type_id), None)
    if not at:
        return None
    workflow_id = at.get("workflow_id")
    if not workflow_id:
        return None
    workflows = (manifest_bundle or {}).get("workflows") or []
    wf = next((w for w in workflows if isinstance(w, dict) and w.get("id") == workflow_id), None)
    if wf is None:
        return None
    return {
        "states": wf.get("states") or [],
        "transitions": wf.get("transitions") or [],
        "initial": wf.get("initial"),
    }


def get_workflow_def(
    manifest_bundle: dict,
    type_id: str,
    *,
    type_kind: str = TYPE_KIND_ARTIFACT,
    ast: Any | None = None,
) -> dict | None:
    """Get workflow definition (states, transitions, initial) for the given artifact type."""
    if ast is not None:
        return _workflow_def_from_defs(manifest_bundle, type_id, ast)
    if (manifest_bundle or {}).get("defs"):
        ast = _to_ast_fallback(manifest_bundle)
        return _workflow_def_from_defs(manifest_bundle, type_id, ast)
    return _workflow_def_from_flat(manifest_bundle, type_id)


def _state_ids(states: list[Any]) -> list[str]:
    """Normalize states to list of state id strings."""
    result: list[str] = []
    for s in states or []:
        if isinstance(s, dict):
            sid = s.get("id") if isinstance(s.get("id"), str) else str(s.get("id", ""))
            if sid:
                result.append(sid)
        elif isinstance(s, str) and s:
            result.append(s)
    return result


def _transitions_list(transitions: list[Any]) -> list[tuple[str, str, dict, str, str, Any]]:
    """Normalize transitions to (from, to, action_dict, trigger, label, guard). guard is raw manifest value or None."""
    result: list[tuple[str, str, dict, str, str, Any]] = []
    for t in transitions or []:
        if not isinstance(t, dict) or "from" not in t or "to" not in t:
            continue
        fr, to = str(t.get("from", "")), str(t.get("to", ""))
        if not fr or not to:
            continue
        action_dict = {
            "on_leave": list(t.get("on_leave") or []),
            "on_enter": list(t.get("on_enter") or []),
        }
        trigger = str(t.get("trigger") or to)
        label = str(t.get("trigger_label") or t.get("trigger") or to)
        guard = t.get("guard")
        result.append((fr, to, action_dict, trigger, label, guard))
    return result


def build_state_machine(workflow_def: dict) -> Any | None:
    """Build a Statelesspy StateMachine from a workflow def (states + transitions).

    Uses target state id as trigger so that permitted_triggers() yields state ids we can transition to.
    Reserved for future use (e.g. when adding guard evaluation via statelesspy).
    """
    try:
        from stateless import StateMachine
    except ImportError:
        return None
    state_ids = _state_ids(workflow_def.get("states") or [])
    if not state_ids:
        return None
    initial = workflow_def.get("initial")
    if initial is None or initial not in state_ids:
        initial = state_ids[0]
    sm: StateMachine[str, str] = StateMachine(initial)
    transitions = _transitions_list(workflow_def.get("transitions") or [])
    for fr, to, *__ in transitions:
        if fr not in state_ids or to not in state_ids:
            continue
        trigger = to
        sm.configure(fr).permit(trigger, to)
    return sm


def get_initial_state(
    manifest_bundle: dict,
    type_id: str,
    *,
    type_kind: str = TYPE_KIND_ARTIFACT,
    ast: Any | None = None,
) -> str | None:
    """Return initial state for the artifact type's workflow."""
    wf_def = get_workflow_def(manifest_bundle, type_id, type_kind=type_kind, ast=ast)
    if not wf_def:
        return None
    state_ids = _state_ids(wf_def.get("states") or [])
    if not state_ids:
        return None
    initial = wf_def.get("initial")
    if initial is not None and initial in state_ids:
        return initial
    return state_ids[0]


def is_valid_transition(
    manifest_bundle: dict,
    type_id: str,
    from_state: str,
    to_state: str,
    *,
    type_kind: str = TYPE_KIND_ARTIFACT,
    ast: Any | None = None,
) -> bool:
    """Return True if (from_state, to_state) is allowed by the workflow."""
    wf_def = get_workflow_def(manifest_bundle, type_id, type_kind=type_kind, ast=ast)
    if not wf_def:
        return False
    transitions = _transitions_list(wf_def.get("transitions") or [])
    allowed = {(fr, to) for fr, to, *__ in transitions}
    return (from_state, to_state) in allowed


def get_transition_actions(
    manifest_bundle: dict,
    type_id: str,
    from_state: str,
    to_state: str,
    *,
    type_kind: str = TYPE_KIND_ARTIFACT,
    ast: Any | None = None,
) -> dict[str, list[str]]:
    """Return on_leave and on_enter action names for the transition (from manifest)."""
    wf_def = get_workflow_def(manifest_bundle, type_id, type_kind=type_kind, ast=ast)
    if not wf_def:
        return {"on_leave": [], "on_enter": []}
    for fr, to, actions, *__ in _transitions_list(wf_def.get("transitions") or []):
        if fr == from_state and to == to_state:
            return actions
    return {"on_leave": [], "on_enter": []}


def get_transition_guard(
    manifest_bundle: dict,
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
    for fr, to, _act, _tr, _lbl, guard in _transitions_list(wf_def.get("transitions") or []):
        if fr == from_state and to == to_state:
            return guard
    return None


def get_permitted_triggers(
    manifest_bundle: dict,
    type_id: str,
    current_state: str,
    *,
    type_kind: str = TYPE_KIND_ARTIFACT,
    ast: Any | None = None,
    entity_snapshot: dict | None = None,
) -> list[tuple[str, str, str]]:
    """Return list of (trigger, to_state, label) permitted from current_state.
    When entity_snapshot is provided, transitions with a guard are filtered by evaluate_guard."""
    from alm.artifact.domain.guard_evaluator import evaluate_guard

    wf_def = get_workflow_def(manifest_bundle, type_id, type_kind=type_kind, ast=ast)
    if not wf_def:
        return []
    transitions = _transitions_list(wf_def.get("transitions") or [])
    result: list[tuple[str, str, str]] = []
    for fr, to_state, _act, trigger, label, guard in transitions:
        if fr != current_state:
            continue
        if guard is not None and entity_snapshot is not None:
            if not evaluate_guard(guard, entity_snapshot):
                continue
        result.append((trigger, to_state, label))
    return result

"""ALM workflow adapter — single entry point for the manifest state graph.

When the ``mpc`` package is installed, builds ``mpc.features.workflow.WorkflowEngine`` from the
manifest and uses it for initial state, valid transitions, permitted triggers, and transition
action names. Policy/ACL (``TransitionPolicy``, ``Policy`` kind, ACL defs) are evaluated in
``mpc_resolver`` / ``evaluate_transition_policy``, not here.

See ``docs/WORKFLOW_ENGINE_BOUNDARY.md``.
"""

from __future__ import annotations

from typing import Any

from alm.artifact.domain.guard_evaluator import evaluate_guard
from alm.artifact.domain.manifest_ast import _get_def, _to_ast_fallback
from alm.artifact.domain.mpc_resolver import TYPE_KIND_ARTIFACT

try:
    from mpc.features.expr import ExprEngine
    from mpc.features.workflow import WorkflowEngine
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
    workflow_def: dict[str, Any] | None = None,
) -> WorkflowEngine | None:
    """Build a native MPC WorkflowEngine for the given artifact type.

    Pass ``workflow_def`` when already resolved to avoid a second ``get_workflow_def`` call.
    """
    if not _HAS_MPC:
        return None

    wf_def = (
        workflow_def
        if workflow_def is not None
        else get_workflow_def(manifest_bundle, type_id, type_kind=type_kind, ast=ast)
    )
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


def _normalize_workflow_transitions_for_mpc(raw: list[Any]) -> list[dict[str, Any]]:
    """MPC WorkflowEngine expects transition trigger id in ``on``; manifest DSL may use ``trigger`` only."""
    out: list[dict[str, Any]] = []
    for t in raw or []:
        if not isinstance(t, dict):
            continue
        td = dict(t)
        if not td.get("on") and td.get("trigger") is not None:
            td["on"] = td["trigger"]
        out.append(td)
    return out


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
    transitions = wf_def.properties.get("transitions") or []
    return {
        "states": wf_def.properties.get("states") or [],
        "transitions": _normalize_workflow_transitions_for_mpc(transitions if isinstance(transitions, list) else []),
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
    return any(t.from_state == from_state and t.to_state == to_state for t in getattr(engine, "transitions", []))


def _transition_actions_from_wf_def(
    wf_def: dict[str, Any] | None,
    from_state: str,
    to_state: str,
) -> dict[str, list[str]]:
    empty: dict[str, list[str]] = {"on_leave": [], "on_enter": []}
    if not wf_def:
        return empty
    for t in wf_def.get("transitions") or []:
        if not isinstance(t, dict):
            continue
        if str(t.get("from", "")) != from_state or str(t.get("to", "")) != to_state:
            continue

        def _list_for(key: str, tr: dict[str, Any]) -> list[str]:
            raw = tr.get(key)
            if raw is None:
                return []
            if isinstance(raw, list):
                return [str(x) for x in raw]
            return [str(raw)]

        return {"on_leave": _list_for("on_leave", t), "on_enter": _list_for("on_enter", t)}
    return empty


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
    wf_def = get_workflow_def(manifest_bundle, type_id, type_kind=type_kind, ast=ast)
    engine = get_workflow_engine(manifest_bundle, type_id, type_kind=type_kind, ast=ast, workflow_def=wf_def)
    if engine and hasattr(engine, "get_transition_actions"):
        return engine.get_transition_actions(from_state, to_state)
    return _transition_actions_from_wf_def(wf_def, from_state, to_state)


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
    wf_def = get_workflow_def(manifest_bundle, type_id, type_kind=type_kind, ast=ast)
    engine = get_workflow_engine(manifest_bundle, type_id, type_kind=type_kind, ast=ast, workflow_def=wf_def)
    if not engine:
        return []

    engine.active_states = {current_state}
    available = engine.available_transitions()

    labels: dict[tuple[str, str, str], str] = {}
    if wf_def:
        for t in wf_def.get("transitions") or []:
            if not isinstance(t, dict):
                continue
            fr_s = str(t.get("from", ""))
            to_s = str(t.get("to", ""))
            on_s = str(t.get("on") or t.get("trigger") or "")
            lab = t.get("trigger_label") or t.get("label") or to_s
            labels[(fr_s, to_s, on_s)] = str(lab)

    result: list[tuple[str, str, str]] = []
    for tr in available:
        label = labels.get((tr.from_state, tr.to_state, tr.on), tr.to_state)
        result.append((tr.on, tr.to_state, label))

    if entity_snapshot is not None:
        filtered: list[tuple[str, str, str]] = []
        for on, to_state, lab in result:
            guard = get_transition_guard(
                manifest_bundle,
                type_id,
                current_state,
                to_state,
                type_kind=type_kind,
                ast=ast,
            )
            if evaluate_guard(guard, entity_snapshot):
                filtered.append((on, to_state, lab))
        return filtered

    return result

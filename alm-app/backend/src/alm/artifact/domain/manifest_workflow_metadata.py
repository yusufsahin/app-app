"""Manifest-driven metadata: task workflow states, tree roots, resolution targets.

Keeps backward-compatible defaults when manifest omits optional sections.
"""

from __future__ import annotations

from typing import Any

# Default tree slugs → system root artifact types (used when manifest has no tree_roots).
DEFAULT_TREE_ROOT_MAP: dict[str, str] = {
    "requirement": "root-requirement",
    "quality": "root-quality",
    "testsuites": "root-testsuites",
    "defect": "root-defect",
}

_FALLBACK_RESOLUTION_TARGETS: frozenset[str] = frozenset({"resolved", "closed", "done"})

_FALLBACK_TASK_OPTIONS: list[dict[str, str]] = [
    {"id": "todo", "label": "To do"},
    {"id": "in_progress", "label": "In progress"},
    {"id": "done", "label": "Done"},
]

# Default when manifest omits system_roots / defs flags (kept in sync with constants.ROOT_ARTIFACT_TYPES).
DEFAULT_SYSTEM_ROOT_TYPES: frozenset[str] = frozenset(
    ("root-requirement", "root-quality", "root-testsuites", "root-defect"),
)

DEFAULT_BURNDOWN_DONE_STATES: tuple[str, ...] = ("done", "closed", "resolved")


def _humanize_id(obj_id: str) -> str:
    if not obj_id:
        return ""
    return obj_id.replace("_", " ").replace("-", " ").title()


def find_workflow_def(manifest_bundle: dict[str, Any] | None, workflow_id: str) -> dict[str, Any] | None:
    """Resolve a workflow from defs or flat ``workflows`` list."""
    if not manifest_bundle or not workflow_id:
        return None
    for d in manifest_bundle.get("defs") or []:
        if isinstance(d, dict) and d.get("kind") == "Workflow" and d.get("id") == workflow_id:
            return d
    for wf in manifest_bundle.get("workflows") or []:
        if isinstance(wf, dict) and wf.get("id") == workflow_id:
            return wf
    return None


def get_tree_root_type_map(manifest_bundle: dict[str, Any] | None) -> dict[str, str]:
    """Merge manifest ``tree_roots`` with DEFAULT_TREE_ROOT_MAP (manifest wins)."""
    out = dict(DEFAULT_TREE_ROOT_MAP)
    roots = (manifest_bundle or {}).get("tree_roots")
    if not isinstance(roots, list):
        return out
    for entry in roots:
        if not isinstance(entry, dict):
            continue
        tid = entry.get("tree_id") or entry.get("id")
        rat = entry.get("root_artifact_type") or entry.get("root_type")
        if tid and rat:
            out[str(tid).strip().lower()] = str(rat)
    return out


def resolve_tree_root_artifact_type(tree_slug: str | None, manifest_bundle: dict[str, Any] | None) -> str | None:
    if not tree_slug or not str(tree_slug).strip():
        return None
    return get_tree_root_type_map(manifest_bundle).get(str(tree_slug).strip().lower())


def _state_entries(wf: dict[str, Any]) -> list[tuple[str, str | None]]:
    """Return (state_id, category_or_none) for each state in workflow."""
    raw = wf.get("states") or []
    out: list[tuple[str, str | None]] = []
    for s in raw:
        if isinstance(s, str):
            out.append((s, None))
        elif isinstance(s, dict):
            sid = s.get("id")
            if sid:
                out.append((str(sid), s.get("category")))
    return out


def get_resolution_target_state_ids(manifest_bundle: dict[str, Any] | None, workflow_id: str) -> frozenset[str]:
    """State ids where resolution is required when workflow defines resolution_options.

    Order: explicit ``resolution_target_states`` → states with category ``completed`` →
    states whose id matches legacy names (resolved/closed/done, case-insensitive).
    """
    wf = find_workflow_def(manifest_bundle, workflow_id) if workflow_id else None
    if wf is None:
        return _FALLBACK_RESOLUTION_TARGETS

    explicit = wf.get("resolution_target_states")
    if isinstance(explicit, list) and explicit:
        return frozenset(str(x) for x in explicit if x is not None and str(x).strip())

    targets: set[str] = set()
    for sid, category in _state_entries(wf):
        if category == "completed":
            targets.add(sid)

    if targets:
        return frozenset(targets)

    legacy_fold = {x.casefold() for x in _FALLBACK_RESOLUTION_TARGETS}
    for sid, _cat in _state_entries(wf):
        if sid.casefold() in legacy_fold:
            targets.add(sid)

    return frozenset(targets)


def _task_workflow_id(manifest_bundle: dict[str, Any] | None) -> str:
    tid = (manifest_bundle or {}).get("task_workflow_id")
    return str(tid).strip() if tid else "task_basic"


def get_task_state_options_and_initial(
    manifest_bundle: dict[str, Any] | None,
) -> tuple[list[dict[str, str]], str]:
    """Return (choice options for task state field, default initial state id)."""
    bundle = manifest_bundle or {}
    wf_id = _task_workflow_id(bundle)
    wf = find_workflow_def(bundle, wf_id)
    if wf is None:
        return list(_FALLBACK_TASK_OPTIONS), "todo"

    states_raw = wf.get("states") or []
    options: list[dict[str, str]] = []
    for s in states_raw:
        if isinstance(s, str):
            options.append({"id": s, "label": _humanize_id(s)})
        elif isinstance(s, dict):
            sid = s.get("id")
            if sid:
                label = s.get("name") or _humanize_id(str(sid))
                options.append({"id": str(sid), "label": str(label)})

    if not options:
        return list(_FALLBACK_TASK_OPTIONS), "todo"

    initial = wf.get("initial")
    if isinstance(initial, dict):
        initial = initial.get("id")
    initial_s = str(initial).strip() if initial else ""
    if not initial_s or not any(o["id"] == initial_s for o in options):
        initial_s = options[0]["id"]

    return options, initial_s


def allowed_task_state_ids(manifest_bundle: dict[str, Any] | None) -> frozenset[str]:
    opts, _ = get_task_state_options_and_initial(manifest_bundle)
    return frozenset(o["id"] for o in opts)


def resolve_system_root_artifact_types(manifest_bundle: dict[str, Any] | None) -> frozenset[str]:
    """Project root artifact types (non-deletable, non-reparentable).

    Order: top-level ``system_roots`` list → defs ``ArtifactType`` with ``is_system_root`` /
    ``flags.is_system_root`` → default triple.
    """
    bundle = manifest_bundle or {}
    explicit = bundle.get("system_roots")
    if isinstance(explicit, list) and explicit:
        return frozenset(str(x).strip() for x in explicit if x and str(x).strip())

    from_defs: set[str] = set()
    for d in bundle.get("defs") or []:
        if not isinstance(d, dict) or d.get("kind") != "ArtifactType":
            continue
        aid = d.get("id")
        if not aid:
            continue
        flags = d.get("flags") if isinstance(d.get("flags"), dict) else {}
        if d.get("is_system_root") or flags.get("is_system_root"):
            from_defs.add(str(aid))

    if from_defs:
        return frozenset(from_defs)

    return DEFAULT_SYSTEM_ROOT_TYPES


def is_system_root_artifact_type(artifact_type: str, manifest_bundle: dict[str, Any] | None) -> bool:
    return artifact_type in resolve_system_root_artifact_types(manifest_bundle)


def resolve_burndown_done_states(manifest_bundle: dict[str, Any] | None) -> tuple[str, ...]:
    raw = (manifest_bundle or {}).get("burndown_done_states")
    if isinstance(raw, list) and len(raw) > 0:
        return tuple(str(x) for x in raw)
    return DEFAULT_BURNDOWN_DONE_STATES


def planning_cycle_field_allowed(manifest_bundle: dict[str, Any] | None, artifact_type: str) -> bool:
    """If ``planning.cycle_for_types`` is omitted, all types may edit cycle. Empty list = none."""
    p = (manifest_bundle or {}).get("planning") or {}
    allow = p.get("cycle_for_types")
    if allow is None:
        return True
    if isinstance(allow, list):
        return len(allow) > 0 and artifact_type in allow
    return True


def planning_area_field_allowed(manifest_bundle: dict[str, Any] | None, artifact_type: str) -> bool:
    p = (manifest_bundle or {}).get("planning") or {}
    allow = p.get("area_for_types")
    if allow is None:
        return True
    if isinstance(allow, list):
        return len(allow) > 0 and artifact_type in allow
    return True

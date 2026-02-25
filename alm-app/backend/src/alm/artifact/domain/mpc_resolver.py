"""MPC manifest resolver — workflow, type defs, policies (generic; ALM uses type_kind='ArtifactType')."""
from __future__ import annotations

import logging
import uuid
from typing import Any

# Manifest def kind for entity types. ALM uses "ArtifactType"; MPC stays generic via type_kind param.
TYPE_KIND_ARTIFACT = "ArtifactType"

try:
    from mpc.ast import ManifestAST, ASTNode, normalize
    from mpc.policy.engine import PolicyEngine
    from mpc.meta.models import DomainMeta

    _HAS_MPC = True
except ModuleNotFoundError:
    _HAS_MPC = False
    ManifestAST = Any  # type: ignore[misc, assignment]
    ASTNode = Any  # type: ignore[misc, assignment]
    PolicyEngine = None  # type: ignore[misc, assignment]
    DomainMeta = None  # type: ignore[misc, assignment]

try:
    from mpc.acl.engine import ACLEngine as _ACLEngine  # noqa: F401

    _HAS_ACL = True
except ModuleNotFoundError:
    _HAS_ACL = False
    _ACLEngine = None  # type: ignore[misc, assignment]

_log = logging.getLogger(__name__)


# --- Fallback when mpc is not installed (e.g. Docker without manifest-platform-core-suite) ---
class _DefNode:
    """Minimal def node: kind, id, properties (dict)."""

    __slots__ = ("kind", "id", "properties")

    def __init__(self, d: dict) -> None:
        self.kind = d.get("kind", "")
        self.id = str(d.get("id", ""))
        self.properties = {k: v for k, v in d.items() if k not in ("kind", "id")}


class _SimpleAST:
    def __init__(self, manifest_bundle: dict) -> None:
        self.defs = [_DefNode(d) for d in manifest_bundle.get("defs", []) if isinstance(d, dict)]


def _to_ast_fallback(manifest_bundle: dict) -> _SimpleAST:
    return _SimpleAST(manifest_bundle or {})


# --- Cache (used for real mpc path) ---
_MANIFEST_AST_CACHE: dict[uuid.UUID, Any] = {}
_CACHE_MAX_SIZE = 128


def get_manifest_ast(version_id: uuid.UUID, manifest_bundle: dict) -> Any:
    """Parse manifest to AST, cached by process_template_version_id.
    Version IDs uniquely identify immutable manifest content."""
    if _HAS_MPC:
        if version_id in _MANIFEST_AST_CACHE:
            return _MANIFEST_AST_CACHE[version_id]
        ast = normalize(manifest_bundle)
        if len(_MANIFEST_AST_CACHE) >= _CACHE_MAX_SIZE:
            for k in list(_MANIFEST_AST_CACHE.keys())[: _CACHE_MAX_SIZE // 2]:
                del _MANIFEST_AST_CACHE[k]
        _MANIFEST_AST_CACHE[version_id] = ast
        return ast
    return _to_ast_fallback(manifest_bundle)


def _to_ast(manifest_bundle: dict) -> Any:
    """Normalize manifest bundle dict to AST (no cache)."""
    if _HAS_MPC:
        return normalize(manifest_bundle)
    return _to_ast_fallback(manifest_bundle)


def _get_def(ast: Any, kind: str, id: str) -> Any | None:
    """Find a def by kind and id."""
    for d in ast.defs:
        if d.kind == kind and d.id == id:
            return d
    return None


def _get_defs_by_kind(ast: Any, kind: str) -> list[Any]:
    """Get all defs of a given kind."""
    return [d for d in ast.defs if d.kind == kind]


def get_type_def(
    manifest_bundle: dict,
    type_kind: str,
    type_id: str,
    ast: Any | None = None,
) -> dict | None:
    """Get type definition as dict (workflow_id, parent_types, child_types, fields). Generic: kind + id."""
    if ast is None:
        ast = _to_ast(manifest_bundle)
    at_def = _get_def(ast, type_kind, type_id)
    if at_def is None:
        return None
    return at_def.properties


def get_artifact_type_def(
    manifest_bundle: dict,
    artifact_type: str,
    ast: Any | None = None,
) -> dict | None:
    """ALM convenience: get ArtifactType def by id. Prefer get_type_def(..., type_kind, type_id) for generic use."""
    return get_type_def(manifest_bundle, TYPE_KIND_ARTIFACT, artifact_type, ast=ast)


def is_valid_parent_child(
    manifest_bundle: dict,
    parent_type: str,
    child_type: str,
    *,
    type_kind: str = TYPE_KIND_ARTIFACT,
    ast: Any | None = None,
) -> bool:
    """Check if child_type can be child of parent_type per manifest hierarchy (generic type_kind)."""
    if ast is None:
        ast = _to_ast(manifest_bundle)
    child_def = _get_def(ast, type_kind, child_type)
    parent_def = _get_def(ast, type_kind, parent_type)
    if child_def is None or parent_def is None:
        return False
    allowed_parents = child_def.properties.get("parent_types")
    allowed_children = parent_def.properties.get("child_types")
    if allowed_children is not None and child_type not in allowed_children:
        return False
    if allowed_parents is not None and parent_type not in allowed_parents:
        return False
    if allowed_parents is None and allowed_children is None:
        return False
    return True


def check_transition_policies(
    manifest_bundle: dict,
    to_state: str,
    entity_snapshot: dict,
    *,
    type_id: str | None = None,
    type_kind: str = TYPE_KIND_ARTIFACT,
    ast: Any | None = None,
) -> list[str]:
    """Check TransitionPolicy defs for entering to_state. Returns list of violation messages."""
    if ast is None:
        ast = _to_ast(manifest_bundle)
    violations: list[str] = []
    for d in _get_defs_by_kind(ast, "TransitionPolicy"):
        when = d.properties.get("when") or {}
        if when.get("state") != to_state:
            continue
        require = d.properties.get("require")
        if require == "assignee" and not entity_snapshot.get("assignee_id"):
            violations.append(f"Assignee required when entering state '{to_state}'")
    return violations


def get_transition_actions(
    manifest_bundle: dict,
    type_id: str,
    from_state: str,
    to_state: str,
    *,
    type_kind: str = TYPE_KIND_ARTIFACT,
    ast: Any | None = None,
) -> dict[str, list[str]]:
    """Get on_leave and on_enter action names for the transition (generic type_kind).
    Delegates to workflow_sm adapter (single source for workflow graph)."""
    from alm.artifact.domain.workflow_sm import get_transition_actions as _get_transition_actions

    return _get_transition_actions(
        manifest_bundle, type_id, from_state, to_state, type_kind=type_kind, ast=ast
    )


def get_workflow_transition_options(
    manifest_bundle: dict,
    workflow_id: str,
) -> tuple[list[str], list[str]]:
    """Return (allowed_state_reason_ids, allowed_resolution_ids) for the workflow."""
    allowed_reasons: list[str] = []
    allowed_resolutions: list[str] = []
    for d in (manifest_bundle or {}).get("defs", []):
        if not isinstance(d, dict) or d.get("kind") != "Workflow" or d.get("id") != workflow_id:
            continue
        for opt in d.get("state_reason_options") or []:
            if isinstance(opt, dict) and "id" in opt:
                allowed_reasons.append(str(opt["id"]))
        for opt in d.get("resolution_options") or []:
            if isinstance(opt, dict) and "id" in opt:
                allowed_resolutions.append(str(opt["id"]))
        break
    return (allowed_reasons, allowed_resolutions)


def manifest_defs_to_flat(manifest_bundle: dict) -> dict:
    """Convert defs format to flat workflows + artifact_types + link_types for frontend consumption.
    If bundle has top-level workflows/artifact_types but no defs, returns them as-is (flat format).
    """
    if not manifest_bundle:
        return {"workflows": [], "artifact_types": [], "link_types": []}

    defs_list = manifest_bundle.get("defs", [])
    if not defs_list:
        # Flat format: top-level workflows, artifact_types, link_types (e.g. from UI save)
        wf = manifest_bundle.get("workflows")
        at = manifest_bundle.get("artifact_types")
        lt = manifest_bundle.get("link_types")
        return {
            "workflows": wf if isinstance(wf, list) else [],
            "artifact_types": at if isinstance(at, list) else [],
            "link_types": lt if isinstance(lt, list) else [],
        }

    workflows: list[dict] = []
    artifact_types: list[dict] = []
    link_types: list[dict] = []

    for d in defs_list:
        if not isinstance(d, dict):
            continue
        kind = d.get("kind", "")
        obj_id = d.get("id", "")

        if kind == "Workflow":
            transitions_raw = d.get("transitions", [])
            transitions = []
            for t in transitions_raw:
                if isinstance(t, dict) and "from" in t and "to" in t:
                    tr: dict = {"from": str(t["from"]), "to": str(t["to"])}
                    if t.get("trigger") is not None:
                        tr["trigger"] = str(t["trigger"])
                    if t.get("trigger_label") is not None:
                        tr["trigger_label"] = str(t["trigger_label"])
                    if t.get("guard") is not None:
                        tr["guard"] = t["guard"]
                    transitions.append(tr)
            wf = {
                "id": obj_id,
                "states": d.get("states", []),
                "transitions": transitions,
            }
            if d.get("state_reason_options"):
                wf["state_reason_options"] = d["state_reason_options"]
            if d.get("resolution_options"):
                wf["resolution_options"] = d["resolution_options"]
            workflows.append(wf)
        elif kind == "ArtifactType":
            at = {
                "id": obj_id,
                "name": d.get("name") or _humanize_id(obj_id),
                "workflow_id": d.get("workflow_id", ""),
            }
            if d.get("parent_types"):
                at["parent_types"] = d["parent_types"]
            if d.get("child_types"):
                at["child_types"] = d["child_types"]
            if d.get("fields"):
                at["fields"] = d["fields"]
            artifact_types.append(at)
        elif kind == "LinkType":
            link_types.append({
                "id": obj_id,
                "name": d.get("name") or _humanize_id(obj_id),
            })

    return {"workflows": workflows, "artifact_types": artifact_types, "link_types": link_types}


def _humanize_id(obj_id: str) -> str:
    """Convert snake_case or kebab-case id to Title Case."""
    if not obj_id:
        return ""
    return obj_id.replace("_", " ").replace("-", " ").title()


def evaluate_transition_policy(
    ast: Any,
    event: dict[str, Any],
    actor_roles: list[str] | None = None,
) -> tuple[bool, list[str]]:
    """Run MPC PolicyEngine on transition event (D1). Returns (allow, violation_messages)."""
    if not _HAS_MPC or PolicyEngine is None or DomainMeta is None:
        return (True, [])

    try:
        meta = DomainMeta()
        engine = PolicyEngine(ast=ast, meta=meta)
        result = engine.evaluate(event, actor_roles=actor_roles or [])
        if result.allow:
            return (True, [])
        return (False, [r.summary for r in result.reasons])
    except Exception as e:  # noqa: BLE001
        _log.warning("PolicyEngine.evaluate failed: %s", e, exc_info=True)
        return (False, ["Policy check temporarily unavailable"])


def acl_check(
    ast: Any,
    action: str,
    resource: str,
    actor_roles: list[str],
) -> tuple[bool, list[str]]:
    """P2: Run MPC ACLEngine.check (allow/deny). No maskField. Returns (allowed, denial_reasons)."""
    if not _HAS_ACL or _ACLEngine is None:
        return (True, [])

    try:
        engine = _ACLEngine(ast)
        result = engine.check(
            action=action,
            resource=resource,
            actor_roles=actor_roles or [],
        )
        allowed = getattr(result, "allowed", getattr(result, "allow", True))
        if allowed:
            return (True, [])
        reasons = getattr(result, "reasons", [])
        if isinstance(reasons, list) and reasons:
            return (False, [getattr(r, "summary", str(r)) for r in reasons])
        return (False, ["ACL denied"])
    except Exception as e:  # noqa: BLE001
        _log.warning("ACLEngine.check failed: %s", e, exc_info=True)
        return (False, ["ACL check temporarily unavailable"])

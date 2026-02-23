"""MPC manifest resolver — workflow, artifact types, policies for artifact operations."""
from __future__ import annotations

from mpc.ast import ManifestAST, ASTNode, normalize
from mpc.workflow import WorkflowEngine


def _to_ast(manifest_bundle: dict) -> ManifestAST:
    """Normalize manifest bundle dict to ManifestAST."""
    return normalize(manifest_bundle)


def _get_def(ast: ManifestAST, kind: str, id: str) -> ASTNode | None:
    """Find a def by kind and id."""
    for d in ast.defs:
        if d.kind == kind and d.id == id:
            return d
    return None


def _get_defs_by_kind(ast: ManifestAST, kind: str) -> list[ASTNode]:
    """Get all defs of a given kind."""
    return [d for d in ast.defs if d.kind == kind]


def get_workflow_engine(
    manifest_bundle: dict, artifact_type: str
) -> WorkflowEngine | None:
    """Resolve workflow for artifact type and return WorkflowEngine instance."""
    ast = _to_ast(manifest_bundle)
    at_def = _get_def(ast, "ArtifactType", artifact_type)
    if at_def is None:
        return None
    workflow_id = at_def.properties.get("workflow_id")
    if not workflow_id:
        return None
    wf_def = _get_def(ast, "Workflow", workflow_id)
    if wf_def is None:
        return None
    return WorkflowEngine.from_ast_node(wf_def)


def get_artifact_type_def(manifest_bundle: dict, artifact_type: str) -> dict | None:
    """Get artifact type definition as dict (workflow_id, parent_types, child_types, fields)."""
    ast = _to_ast(manifest_bundle)
    at_def = _get_def(ast, "ArtifactType", artifact_type)
    if at_def is None:
        return None
    return at_def.properties


def is_valid_parent_child(
    manifest_bundle: dict, parent_type: str, child_type: str
) -> bool:
    """Check if child_type can be child of parent_type per manifest hierarchy."""
    ast = _to_ast(manifest_bundle)
    child_def = _get_def(ast, "ArtifactType", child_type)
    parent_def = _get_def(ast, "ArtifactType", parent_type)
    if child_def is None or parent_def is None:
        return False
    allowed_parents = child_def.properties.get("parent_types")
    allowed_children = parent_def.properties.get("child_types")
    # If parent defines child_types, child must be in the list
    if allowed_children is not None and child_type not in allowed_children:
        return False
    # If child defines parent_types, parent must be in the list
    if allowed_parents is not None and parent_type not in allowed_parents:
        return False
    # When neither defines hierarchy (both None), disallow to be conservative
    if allowed_parents is None and allowed_children is None:
        return False
    return True


def check_transition_policies(
    manifest_bundle: dict,
    artifact_type: str,
    to_state: str,
    entity_snapshot: dict,
) -> list[str]:
    """
    Check TransitionPolicy defs for entering to_state.
    Returns list of violation messages. Empty if all pass.
    """
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
    artifact_type: str,
    from_state: str,
    to_state: str,
) -> dict[str, list[str]]:
    """Get on_leave and on_enter action names for the transition."""
    engine = get_workflow_engine(manifest_bundle, artifact_type)
    if engine is None:
        return {"on_leave": [], "on_enter": []}
    return engine.get_transition_actions(from_state, to_state)

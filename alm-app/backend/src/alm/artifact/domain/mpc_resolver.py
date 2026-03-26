"""MPC manifest resolver — thin facade over cache, transform, MPC engines, and mode-aware fallbacks.

Workflow graph lives in ``workflow_sm``. TransitionPolicy + Policy/ACL/redaction are composed here.
"""

from __future__ import annotations

import logging
import uuid  # noqa: TC003
from datetime import UTC, datetime
from typing import Any

from alm.artifact.domain import mpc_facade
from alm.artifact.domain.fallback_policy import acl_result_without_mpc_engine as _acl_fallback_result
from alm.artifact.domain.fallback_policy import audit_mpc_degraded, effective_mpc_mode, policy_result_without_mpc_engine
from alm.artifact.domain.manifest_ast import get_def as _get_def
from alm.artifact.domain.manifest_cache import get_manifest_ast
from alm.artifact.domain.manifest_transform import (
    get_workflow_transition_options,
    manifest_defs_to_flat,
    to_ast,
)
from alm.artifact.domain.mpc_facade import HAS_MPC as _HAS_MPC

TYPE_KIND_ARTIFACT = "ArtifactType"

_log = logging.getLogger(__name__)

# Legacy / adapter names (tests, workflow_sm, manifest_acl)
_to_ast = to_ast


def get_type_def(
    manifest_bundle: dict[str, Any],
    type_kind: str,
    type_id: str,
    ast: Any | None = None,
) -> dict[str, Any] | None:
    if ast is None:
        ast = _to_ast(manifest_bundle)
    at_def = _get_def(ast, type_kind, type_id)
    if at_def is None:
        return None
    return dict(at_def.properties)


def get_artifact_type_def(
    manifest_bundle: dict[str, Any],
    artifact_type: str,
    ast: Any | None = None,
) -> dict[str, Any] | None:
    return get_type_def(manifest_bundle, TYPE_KIND_ARTIFACT, artifact_type, ast=ast)


def is_valid_parent_child(
    manifest_bundle: dict[str, Any],
    parent_type: str,
    child_type: str,
    *,
    type_kind: str = TYPE_KIND_ARTIFACT,
    ast: Any | None = None,
) -> bool:
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
    return not (allowed_parents is None and allowed_children is None)


def get_transition_actions(
    manifest_bundle: dict[str, Any],
    type_id: str,
    from_state: str,
    to_state: str,
    *,
    type_kind: str = TYPE_KIND_ARTIFACT,
    ast: Any | None = None,
) -> dict[str, list[str]]:
    from alm.artifact.domain.workflow_sm import get_transition_actions as _get_transition_actions

    return _get_transition_actions(manifest_bundle, type_id, from_state, to_state, type_kind=type_kind, ast=ast)


def build_artifact_transition_policy_event(
    *,
    artifact_id: uuid.UUID,
    artifact_type: str,
    from_state: str,
    to_state: str,
    assignee_id: Any,
    custom_fields: dict[str, Any] | None,
    project_id: uuid.UUID,
    tenant_id: uuid.UUID,
    updated_by: uuid.UUID | None,
    actor_roles: tuple[str, ...] | None,
) -> dict[str, Any]:
    return {
        "kind": "transition",
        "name": "artifact.transition",
        "object": {
            "id": str(artifact_id),
            "type": "artifact",
            "artifact_type": artifact_type,
            "state": from_state,
            "assignee_id": assignee_id,
            "custom_fields": custom_fields or {},
        },
        "actor": {
            "id": str(updated_by) if updated_by else "",
            "type": "user",
            "tenant_id": str(tenant_id),
            "roles": list(actor_roles) if actor_roles else [],
        },
        "context": {
            "from_state": from_state,
            "to_state": to_state,
            "project_id": str(project_id),
        },
        "timestamp": datetime.now(UTC).isoformat(),
    }


def check_transition_policies(ast: Any, event: dict[str, Any]) -> list[str]:
    violations: list[str] = []
    obj = event.get("object") if isinstance(event.get("object"), dict) else {}
    ctx = event.get("context") if isinstance(event.get("context"), dict) else {}
    to_state = ctx.get("to_state")
    assignee_id = obj.get("assignee_id")

    for d in getattr(ast, "defs", []) or []:
        kind = getattr(d, "kind", "")
        if kind != "TransitionPolicy":
            continue
        props = getattr(d, "properties", {}) or {}
        when = props.get("when") if isinstance(props.get("when"), dict) else {}
        req_state = when.get("state")
        if req_state is not None and to_state != req_state:
            continue
        require = props.get("require")
        if require == "assignee" and not assignee_id:
            pid = getattr(d, "id", "") or "transition_policy"
            violations.append(
                f"Transition policy '{pid}': assignee required when entering state '{to_state}'",
            )
    return violations


def evaluate_transition_policy(
    ast: Any,
    event: dict[str, Any],
    actor_roles: list[str] | None = None,
) -> tuple[bool, list[str]]:
    tp_violations = check_transition_policies(ast, event)
    if tp_violations:
        return (False, tp_violations)

    if not _HAS_MPC:
        return policy_result_without_mpc_engine()

    try:
        allow, reasons = mpc_facade.policy_engine_evaluate(ast, event, actor_roles or [])
        return (allow, reasons)
    except Exception as e:  # noqa: BLE001
        _log.warning("PolicyEngine.evaluate failed: %s", e, exc_info=True)
        if effective_mpc_mode() == "strict":
            return (False, ["Policy check failed; strict mode denies on engine error."])
        audit_mpc_degraded(
            "evaluate_transition_policy",
            mpc_available=True,
            detail=str(e),
        )
        return (False, ["Policy check temporarily unavailable"])


def acl_check(
    ast: Any,
    action: str,
    resource: str,
    actor_roles: list[str],
) -> tuple[bool, list[str]]:
    if not _HAS_MPC:
        return _acl_fallback_result()

    try:
        return mpc_facade.acl_engine_check(ast, action, resource, actor_roles)
    except Exception as e:  # noqa: BLE001
        _log.warning("ACLEngine.check failed: %s", e, exc_info=True)
        if effective_mpc_mode() == "strict":
            return (False, ["ACL check failed; strict mode denies on engine error."])
        audit_mpc_degraded("acl_check", mpc_available=True, detail=str(e))
        return (False, ["ACL check temporarily unavailable"])


def redact_data(
    ast: Any,
    data: dict[str, Any],
    actor_roles: list[str],
) -> dict[str, Any]:
    if not _HAS_MPC:
        if effective_mpc_mode() == "strict":
            audit_mpc_degraded("redact_data", mpc_available=False, detail="unredacted_payload")
        return data

    try:
        return mpc_facade.redaction_engine_redact(ast, data, actor_roles)
    except Exception as e:  # noqa: BLE001
        _log.warning("Redactor.redact failed: %s", e, exc_info=True)
        if effective_mpc_mode() == "strict":
            audit_mpc_degraded("redact_data", mpc_available=True, detail=str(e))
        return data


__all__ = [
    "TYPE_KIND_ARTIFACT",
    "_HAS_MPC",
    "_to_ast",
    "acl_check",
    "build_artifact_transition_policy_event",
    "check_transition_policies",
    "evaluate_transition_policy",
    "get_artifact_type_def",
    "get_manifest_ast",
    "get_transition_actions",
    "get_type_def",
    "get_workflow_transition_options",
    "is_valid_parent_child",
    "manifest_defs_to_flat",
    "redact_data",
]

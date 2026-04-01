"""Manifest bundle transforms: defs→flat, workflow option lists, normalize without cache."""

from __future__ import annotations

from typing import Any

from alm.artifact.domain.manifest_ast import to_ast_fallback
from alm.artifact.domain.mpc_facade import HAS_MPC, mpc_normalize


def to_ast(manifest_bundle: dict[str, Any]) -> Any:
    """Normalize manifest bundle dict to AST (no cache)."""
    if HAS_MPC:
        return mpc_normalize(manifest_bundle)
    return to_ast_fallback(manifest_bundle)


def manifest_defs_to_flat(manifest_bundle: dict[str, Any]) -> dict[str, Any]:
    """Convert defs format to flat workflows + artifact_types + relationship_types for frontend consumption."""
    if not manifest_bundle:
        return {"workflows": [], "artifact_types": [], "relationship_types": []}

    defs_list = manifest_bundle.get("defs", [])
    if not defs_list:
        return {
            "workflows": list(manifest_bundle.get("workflows") or []),
            "artifact_types": list(manifest_bundle.get("artifact_types") or []),
            "relationship_types": list(manifest_bundle.get("relationship_types") or []),
        }

    workflows: list[dict[str, Any]] = []
    artifact_types: list[dict[str, Any]] = []
    relationship_types: list[dict[str, Any]] = []

    for d in defs_list:
        if not isinstance(d, dict):
            continue
        kind = d.get("kind", "")
        obj_id = d.get("id", "")

        if kind == "Workflow":
            wf = {
                "id": obj_id,
                "states": d.get("states", []),
                "transitions": [],
            }
            for t in d.get("transitions", []):
                if isinstance(t, dict) and "from" in t and "to" in t:
                    tr = {"from": str(t["from"]), "to": str(t["to"])}
                    for field in ("trigger", "trigger_label", "guard"):
                        if t.get(field) is not None:
                            tr[field] = t[field]  # type: ignore[literal-required]
                    wf["transitions"].append(tr)  # type: ignore[attr-defined]
            if d.get("state_reason_options"):
                wf["state_reason_options"] = d["state_reason_options"]
            if d.get("resolution_options"):
                wf["resolution_options"] = d["resolution_options"]
            if d.get("resolution_target_states"):
                wf["resolution_target_states"] = d["resolution_target_states"]
            workflows.append(wf)
        elif kind == "ArtifactType":
            at = {
                "id": obj_id,
                "name": d.get("name") or _humanize_id(str(obj_id)),
                "workflow_id": d.get("workflow_id", ""),
            }
            for field in ("parent_types", "child_types", "fields"):
                if d.get(field):
                    at[field] = d[field]  # type: ignore[literal-required]
            if d.get("icon"):
                at["icon"] = d["icon"]
            flags = d.get("flags") if isinstance(d.get("flags"), dict) else {}
            if d.get("is_system_root") or flags.get("is_system_root"):
                at["is_system_root"] = True
            artifact_types.append(at)
        elif kind == "LinkType":
            lt: dict[str, Any] = {
                "id": obj_id,
                "name": d.get("name") or _humanize_id(str(obj_id)),
            }
            for opt in (
                "direction",
                "inverse_name",
                "label",
                "cardinality",
                "from_types",
                "to_types",
                "description",
            ):
                if d.get(opt) is not None:
                    lt[opt] = d[opt]
            relationship_types.append(lt)

    return {"workflows": workflows, "artifact_types": artifact_types, "relationship_types": relationship_types}


def _humanize_id(obj_id: str) -> str:
    if not obj_id:
        return ""
    return obj_id.replace("_", " ").replace("-", " ").title()


def get_workflow_transition_options(
    manifest_bundle: dict[str, Any],
    workflow_id: str,
) -> tuple[list[str], list[str]]:
    """Return (allowed_state_reason_ids, allowed_resolution_ids) for the workflow."""
    allowed_reasons: list[str] = []
    allowed_resolutions: list[str] = []
    bundle = manifest_bundle or {}

    for d in bundle.get("defs", []):
        if not isinstance(d, dict) or d.get("kind") != "Workflow" or d.get("id") != workflow_id:
            continue
        for opt in d.get("state_reason_options") or []:
            if isinstance(opt, dict) and "id" in opt:
                allowed_reasons.append(str(opt["id"]))
        for opt in d.get("resolution_options") or []:
            if isinstance(opt, dict) and "id" in opt:
                allowed_resolutions.append(str(opt["id"]))
        return (allowed_reasons, allowed_resolutions)

    for wf in bundle.get("workflows") or []:
        if not isinstance(wf, dict) or wf.get("id") != workflow_id:
            continue
        for opt in wf.get("state_reason_options") or []:
            if isinstance(opt, dict) and "id" in opt:
                allowed_reasons.append(str(opt["id"]))
        for opt in wf.get("resolution_options") or []:
            if isinstance(opt, dict) and "id" in opt:
                allowed_resolutions.append(str(opt["id"]))
        break
    return (allowed_reasons, allowed_resolutions)

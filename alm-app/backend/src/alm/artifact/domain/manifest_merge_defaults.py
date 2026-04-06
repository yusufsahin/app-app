"""Merge optional manifest metadata defaults (idempotent) for backfill and upgrades.

Also merges Quality / Campaign domain defs (``tree_id: testsuites``: collections, test-suite,
test-run, test-campaign; catalog quality-folder; link types) when not already present — see
``quality_manifest_extension.merge_quality_domain_into_defs``.
"""

from __future__ import annotations

import copy
from typing import Any

from alm.artifact.domain.quality_manifest_extension import (
    ensure_quality_folder_workflow,
    merge_quality_domain_into_defs,
)

# Keep aligned with seed _MANIFEST_TASK_AND_TREES / _TASK_BASIC_WORKFLOW_DEF.
_DEFAULT_TREE_ROOTS: list[dict[str, str]] = [
    {"tree_id": "requirement", "root_artifact_type": "root-requirement"},
    {"tree_id": "quality", "root_artifact_type": "root-quality"},
    {"tree_id": "testsuites", "root_artifact_type": "root-testsuites"},
    {"tree_id": "defect", "root_artifact_type": "root-defect"},
]

_TASK_BASIC_WORKFLOW_DEF: dict[str, Any] = {
    "kind": "Workflow",
    "id": "task_basic",
    "initial": "todo",
    "states": ["todo", "in_progress", "done"],
    "transitions": [
        {"from": "todo", "to": "in_progress", "on": "start"},
        {"from": "in_progress", "to": "done", "on": "complete"},
        {"from": "done", "to": "in_progress", "on": "reopen"},
    ],
}


def _has_task_basic(defs: list[Any]) -> bool:
    return any(isinstance(d, dict) and d.get("kind") == "Workflow" and d.get("id") == "task_basic" for d in defs)


def _append_task_basic(defs: list[Any]) -> None:
    """Append task_basic workflow when missing (order-independent for Workflow defs)."""
    defs.append(copy.deepcopy(_TASK_BASIC_WORKFLOW_DEF))


def _patch_resolution_targets(defs: list[Any]) -> None:
    for d in defs:
        if not isinstance(d, dict) or d.get("kind") != "Workflow":
            continue
        if d.get("resolution_target_states"):
            continue
        if not d.get("resolution_options"):
            continue
        wid = str(d.get("id") or "")
        if wid in ("basic", "ado_basic"):
            d["resolution_target_states"] = ["resolved", "closed"]
        elif wid in ("scrum", "kanban"):
            d["resolution_target_states"] = ["done"]


def merge_manifest_metadata_defaults(bundle: dict[str, Any] | None) -> dict[str, Any]:
    """Deep-copy bundle and fill default tree_roots, task workflow, and resolution hints when missing."""
    out = copy.deepcopy(bundle or {})
    if not out.get("tree_roots"):
        out["tree_roots"] = copy.deepcopy(_DEFAULT_TREE_ROOTS)
    if not out.get("task_workflow_id"):
        out["task_workflow_id"] = "task_basic"

    defs = out.get("defs")
    if isinstance(defs, list):
        if not _has_task_basic(defs):
            _append_task_basic(defs)
        _patch_resolution_targets(defs)
        out["defs"] = merge_quality_domain_into_defs(defs)
        ensure_quality_folder_workflow(out["defs"])

    return out

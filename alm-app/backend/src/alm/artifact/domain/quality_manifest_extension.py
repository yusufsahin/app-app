"""Inject Quality domain (test-suite, test-run, test-campaign, folders, links) into manifest defs.

Used by process template seed and by merge_manifest_metadata_defaults (idempotent).
"""

from __future__ import annotations

from typing import Any

_QUALITY_RUN_WORKFLOW_DEF: dict[str, Any] = {
    "kind": "Workflow",
    "id": "quality_run",
    "initial": "not_started",
    "finals": ["completed", "failed", "cancelled"],
    "states": ["not_started", "in_progress", "completed", "failed", "cancelled"],
    "transitions": [
        {"from": "not_started", "to": "in_progress", "on": "start"},
        {"from": "in_progress", "to": "completed", "on": "complete"},
        {"from": "in_progress", "to": "failed", "on": "fail"},
        {"from": "in_progress", "to": "cancelled", "on": "cancel"},
    ],
}
_QUALITY_CAMPAIGN_WORKFLOW_DEF: dict[str, Any] = {
    "kind": "Workflow",
    "id": "quality_campaign",
    "initial": "not_started",
    "finals": ["completed", "failed", "cancelled"],
    "states": ["not_started", "in_progress", "completed", "failed", "cancelled"],
    "transitions": [
        {"from": "not_started", "to": "in_progress", "on": "start"},
        {"from": "in_progress", "to": "completed", "on": "complete"},
        {"from": "in_progress", "to": "failed", "on": "fail"},
        {"from": "in_progress", "to": "cancelled", "on": "cancel"},
    ],
}
_QUALITY_EXTRA_LINK_TYPES: list[dict[str, Any]] = [
    {"kind": "LinkType", "id": "suite_includes_test", "name": "Suite includes test"},
    {"kind": "LinkType", "id": "run_for_suite", "name": "Run for suite"},
    {"kind": "LinkType", "id": "campaign_includes_suite", "name": "Campaign includes suite"},
]


def _quality_domain_extra_artifact_types(test_case_workflow_id: str) -> list[dict[str, Any]]:
    return [
        {
            "kind": "ArtifactType",
            "id": "quality-folder",
            "name": "Quality folder",
            "workflow_id": "root",
            "parent_types": ["root-quality", "quality-folder"],
            "child_types": [
                "quality-folder",
                "test-case",
                "test-suite",
                "test-run",
                "test-campaign",
            ],
            "fields": [],
        },
        {
            "kind": "ArtifactType",
            "id": "test-suite",
            "name": "Test suite",
            "workflow_id": test_case_workflow_id,
            "parent_types": ["root-quality", "quality-folder"],
            "child_types": [],
            "fields": [{"id": "suite_note", "name": "Notes", "type": "string"}],
        },
        {
            "kind": "ArtifactType",
            "id": "test-run",
            "name": "Test run",
            "workflow_id": "quality_run",
            "parent_types": ["root-quality", "quality-folder"],
            "child_types": [],
            "fields": [
                {"id": "environment", "name": "Environment", "type": "string"},
                {"id": "run_metrics_json", "name": "Run metrics (JSON)", "type": "string"},
            ],
        },
        {
            "kind": "ArtifactType",
            "id": "test-campaign",
            "name": "Test campaign",
            "workflow_id": "quality_campaign",
            "parent_types": ["root-quality", "quality-folder"],
            "child_types": [],
            "fields": [
                {"id": "target_environment", "name": "Target environment", "type": "string"},
                {"id": "campaign_config_json", "name": "Suite order config (JSON)", "type": "string"},
            ],
        },
    ]


def quality_domain_already_in_defs(defs: list[Any]) -> bool:
    """True if Quality extension artifact types are already present (idempotency marker)."""
    return any(isinstance(d, dict) and d.get("kind") == "ArtifactType" and d.get("id") == "test-suite" for d in defs)


def _inject_quality_domain_defs(defs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    test_case_wf = "basic"
    for d in defs:
        if isinstance(d, dict) and d.get("kind") == "ArtifactType" and d.get("id") == "test-case":
            test_case_wf = str(d.get("workflow_id") or "basic")
            break

    out: list[dict[str, Any]] = []
    quality_links_added = False
    i = 0
    while i < len(defs):
        d = defs[i]
        if not isinstance(d, dict):
            out.append(d)
            i += 1
            continue
        kind = d.get("kind")
        aid = d.get("id")

        if kind == "Workflow" and aid == "task_basic":
            out.append(d)
            out.append(dict(_QUALITY_RUN_WORKFLOW_DEF))
            out.append(dict(_QUALITY_CAMPAIGN_WORKFLOW_DEF))
            i += 1
            continue

        if kind == "ArtifactType" and aid == "root-quality":
            out.append(
                {
                    **d,
                    "child_types": [
                        "quality-folder",
                        "test-case",
                        "test-suite",
                        "test-run",
                        "test-campaign",
                    ],
                }
            )
            i += 1
            continue

        if kind == "ArtifactType" and aid == "test-case":
            fields = list(d.get("fields") or [])
            if not any(isinstance(f, dict) and f.get("id") == "test_steps_json" for f in fields):
                fields.append(
                    {
                        "id": "test_steps_json",
                        "name": "Test steps (JSON)",
                        "type": "string",
                    }
                )
            out.append(
                {
                    **d,
                    "parent_types": ["root-quality", "quality-folder"],
                    "fields": fields,
                }
            )
            out.extend(_quality_domain_extra_artifact_types(test_case_wf))
            i += 1
            continue

        if kind == "LinkType" and aid == "related" and not quality_links_added:
            out.extend([dict(x) for x in _QUALITY_EXTRA_LINK_TYPES])
            quality_links_added = True
            out.append(d)
            i += 1
            continue

        out.append(d)
        i += 1

    return out


def merge_quality_domain_into_defs(defs: list[Any]) -> list[Any]:
    """Return defs with Quality domain merged in; no-op if already applied (idempotent)."""
    if not isinstance(defs, list):
        return defs
    if quality_domain_already_in_defs(defs):
        return defs
    coerced = [x for x in defs if isinstance(x, dict)]
    if len(coerced) != len(defs):
        return defs
    return _inject_quality_domain_defs(coerced)


def with_quality_manifest_bundle(bundle: dict[str, Any]) -> dict[str, Any]:
    """Return bundle copy path for seed: inject Quality defs when defs list is present."""
    raw_defs = bundle.get("defs")
    if not isinstance(raw_defs, list):
        return bundle
    return {**bundle, "defs": merge_quality_domain_into_defs(list(raw_defs))}

"""Relationship type metadata and compatibility helpers."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

RELATED = "related"
IMPACTS = "impacts"
BLOCKS = "blocks"
VERIFIES = "verifies"
AFFECTS = "affects"
DISCOVERED_IN = "discovered_in"
SUITE_INCLUDES_TEST = "suite_includes_test"
RUN_FOR_SUITE = "run_for_suite"
CAMPAIGN_INCLUDES_SUITE = "campaign_includes_suite"

DIRECTED = "directed"
SYMMETRIC = "symmetric"

# Union of planning artifact ids for artifact↔artifact relationships (blocks, impacts, verifies, affects).
# Sprint/work items use the Task entity (tasks.artifact_id → parent artifact), not LinkType endpoints.
# `issue` kept for legacy rows; new manifests use `workitem`.
PLANNING_TYPES = ("epic", "feature", "requirement", "user_story", "workitem", "issue")


@dataclass(frozen=True)
class RelationshipType:
    key: str
    name: str
    forward_label: str
    reverse_label: str
    directionality: str = DIRECTED
    category: str = "related"
    allowed_source_types: tuple[str, ...] = ()
    allowed_target_types: tuple[str, ...] = ()
    description: str | None = None
    supports_ordering: bool = False

    @property
    def is_symmetric(self) -> bool:
        return self.directionality == SYMMETRIC


def _relationship_type(
    key: str,
    *,
    name: str,
    forward_label: str,
    reverse_label: str,
    directionality: str = DIRECTED,
    category: str,
    allowed_source_types: tuple[str, ...] = (),
    allowed_target_types: tuple[str, ...] = (),
    description: str | None = None,
    supports_ordering: bool = False,
) -> RelationshipType:
    return RelationshipType(
        key=key,
        name=name,
        forward_label=forward_label,
        reverse_label=reverse_label,
        directionality=directionality,
        category=category,
        allowed_source_types=allowed_source_types,
        allowed_target_types=allowed_target_types,
        description=description,
        supports_ordering=supports_ordering,
    )


BUILTIN_RELATIONSHIP_TYPES: dict[str, RelationshipType] = {
    RELATED: _relationship_type(
        RELATED,
        name="Related",
        forward_label="Related",
        reverse_label="Related",
        directionality=SYMMETRIC,
        category="related",
        description="General relationship between two artifacts.",
    ),
    IMPACTS: _relationship_type(
        IMPACTS,
        name="Impacts",
        forward_label="Impacts",
        reverse_label="Impacted By",
        category="planning",
        allowed_source_types=PLANNING_TYPES,
        allowed_target_types=PLANNING_TYPES,
        description="A planning item impacts another planning item.",
    ),
    BLOCKS: _relationship_type(
        BLOCKS,
        name="Blocks",
        forward_label="Blocks",
        reverse_label="Blocked By",
        category="planning",
        allowed_source_types=PLANNING_TYPES,
        allowed_target_types=PLANNING_TYPES,
        description="A planning item blocks another planning item.",
    ),
    VERIFIES: _relationship_type(
        VERIFIES,
        name="Verifies",
        forward_label="Verifies",
        reverse_label="Verified By",
        category="quality",
        allowed_source_types=("test-case",),
        allowed_target_types=PLANNING_TYPES,
        description="A test case verifies a planning item.",
    ),
    AFFECTS: _relationship_type(
        AFFECTS,
        name="Affects",
        forward_label="Affects",
        reverse_label="Affected By Defect",
        category="defect",
        allowed_source_types=("defect",),
        allowed_target_types=PLANNING_TYPES,
        description="A defect affects a planning item.",
    ),
    DISCOVERED_IN: _relationship_type(
        DISCOVERED_IN,
        name="Discovered In",
        forward_label="Discovered In Run",
        reverse_label="Found Defects",
        category="quality",
        allowed_source_types=("defect",),
        allowed_target_types=("test-run",),
        description="A defect was discovered in a specific test run.",
    ),
    SUITE_INCLUDES_TEST: _relationship_type(
        SUITE_INCLUDES_TEST,
        name="Suite Includes Test",
        forward_label="Includes Test",
        reverse_label="Included In Suite",
        category="quality",
        allowed_source_types=("test-suite",),
        allowed_target_types=("test-case",),
        description="A test suite includes a test case.",
        supports_ordering=True,
    ),
    RUN_FOR_SUITE: _relationship_type(
        RUN_FOR_SUITE,
        name="Run For Suite",
        forward_label="Run For Suite",
        reverse_label="Runs",
        category="quality",
        allowed_source_types=("test-run",),
        allowed_target_types=("test-suite",),
        description="A test run executes a test suite.",
    ),
    CAMPAIGN_INCLUDES_SUITE: _relationship_type(
        CAMPAIGN_INCLUDES_SUITE,
        name="Campaign Includes Suite",
        forward_label="Includes Suite",
        reverse_label="Included In Campaign",
        category="quality",
        allowed_source_types=("test-campaign",),
        allowed_target_types=("test-suite",),
        description="A test campaign includes a suite.",
        supports_ordering=True,
    ),
}


def _default_category(key: str) -> str:
    if key in {IMPACTS, BLOCKS}:
        return "planning"
    if key in {VERIFIES, DISCOVERED_IN, SUITE_INCLUDES_TEST, RUN_FOR_SUITE, CAMPAIGN_INCLUDES_SUITE}:
        return "quality"
    if key == AFFECTS:
        return "defect"
    return "related"


def _normalize_types(values: Any) -> tuple[str, ...]:
    if not isinstance(values, list):
        return ()
    out: list[str] = []
    for value in values:
        text = str(value or "").strip().lower()
        if text:
            out.append(text)
    return tuple(out)


def resolve_relationship_types(manifest_bundle: dict[str, Any] | None) -> dict[str, RelationshipType]:
    resolved = dict(BUILTIN_RELATIONSHIP_TYPES)
    defs = ((manifest_bundle or {}).get("defs") or []) if manifest_bundle else []
    for item in defs:
        if not isinstance(item, dict) or item.get("kind") != "LinkType":
            continue
        key = str(item.get("id") or "").strip().lower()
        if not key:
            continue
        current = resolved.get(key)
        name = str(item.get("name") or (current.name if current else key.replace("_", " ").title())).strip()
        forward_label = str(item.get("label") or (current.forward_label if current else name)).strip() or name
        reverse_label = str(item.get("inverse_name") or (current.reverse_label if current else forward_label)).strip()
        directionality = str(item.get("direction") or (current.directionality if current else DIRECTED)).strip().lower()
        if directionality not in {DIRECTED, SYMMETRIC}:
            directionality = current.directionality if current else DIRECTED
        resolved[key] = RelationshipType(
            key=key,
            name=name,
            forward_label=forward_label,
            reverse_label=reverse_label or forward_label,
            directionality=directionality,
            category=_default_category(key),
            allowed_source_types=_normalize_types(item.get("from_types")) or (current.allowed_source_types if current else ()),
            allowed_target_types=_normalize_types(item.get("to_types")) or (current.allowed_target_types if current else ()),
            description=str(item.get("description")).strip() if item.get("description") else (current.description if current else None),
            supports_ordering=current.supports_ordering if current else False,
        )
    return resolved


def get_relationship_type(
    manifest_bundle: dict[str, Any] | None,
    relationship_type: str,
) -> RelationshipType:
    key = (relationship_type or RELATED).strip().lower() or RELATED
    resolved = resolve_relationship_types(manifest_bundle)
    return resolved.get(
        key,
        _relationship_type(
            key,
            name=key.replace("_", " ").replace("-", " ").title(),
            forward_label=key.replace("_", " ").replace("-", " ").title(),
            reverse_label=key.replace("_", " ").replace("-", " ").title(),
            directionality=DIRECTED,
            category=_default_category(key),
        ),
    )


def relationship_type_allowed(
    rel_type: RelationshipType,
    source_artifact_type: str,
    target_artifact_type: str,
) -> bool:
    source_type = (source_artifact_type or "").strip().lower()
    target_type = (target_artifact_type or "").strip().lower()
    if rel_type.allowed_source_types and source_type not in rel_type.allowed_source_types:
        return False
    if rel_type.allowed_target_types and target_type not in rel_type.allowed_target_types:
        return False
    return True

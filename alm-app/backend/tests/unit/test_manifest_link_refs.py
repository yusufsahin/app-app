"""Manifest LinkType vs ArtifactType reference validation."""

from __future__ import annotations

from typing import Any

import pytest

from alm.artifact.domain.quality_manifest_extension import with_quality_manifest_bundle
from alm.config.seed import (
    _TASK_BASIC_WORKFLOW_DEF,
    iter_builtin_merged_manifest_bundles_for_tests,
)
from alm.manifest_validation import validate_link_type_artifact_refs


def test_validate_link_refs_empty_bundle() -> None:
    assert validate_link_type_artifact_refs(None) == []
    assert validate_link_type_artifact_refs({}) == []


def test_validate_link_refs_unknown_target_reported() -> None:
    bundle: dict[str, Any] = {
        "defs": [
            {"kind": "ArtifactType", "id": "epic"},
            {
                "kind": "LinkType",
                "id": "blocks",
                "from_types": ["epic"],
                "to_types": ["epic", "phantom_leaf"],
            },
        ]
    }
    err = validate_link_type_artifact_refs(bundle)
    assert len(err) == 1
    assert "phantom_leaf" in err[0]
    assert "blocks" in err[0]


def test_validate_link_refs_unknown_source_reported() -> None:
    bundle: dict[str, Any] = {
        "defs": [
            {"kind": "ArtifactType", "id": "epic"},
            {
                "kind": "LinkType",
                "id": "impacts",
                "from_types": ["ghost", "epic"],
                "to_types": ["epic"],
            },
        ]
    }
    err = validate_link_type_artifact_refs(bundle)
    assert len(err) == 1
    assert "ghost" in err[0]


def test_validate_link_refs_passes_minimal_consistent() -> None:
    bundle: dict[str, Any] = {
        "defs": [
            {"kind": "ArtifactType", "id": "epic"},
            {"kind": "ArtifactType", "id": "feature"},
            {
                "kind": "LinkType",
                "id": "blocks",
                "from_types": ["epic", "feature"],
                "to_types": ["feature"],
            },
        ]
    }
    assert validate_link_type_artifact_refs(bundle) == []


@pytest.fixture
def scrum_like_merged_bundle() -> dict[str, Any]:
    """Mirrors seed scrum link targets after quality merge adds test-run, campaign tree, etc."""
    defs: list[dict[str, Any]] = [
        {"kind": "Workflow", "id": "root", "initial": "Active", "states": ["Active"], "transitions": []},
        {"kind": "Workflow", "id": "scrum", "initial": "new", "states": ["new", "done"], "transitions": []},
        dict(_TASK_BASIC_WORKFLOW_DEF),
        {
            "kind": "ArtifactType",
            "id": "root-requirement",
            "workflow_id": "root",
            "child_types": ["epic"],
            "fields": [],
        },
        {
            "kind": "ArtifactType",
            "id": "root-quality",
            "workflow_id": "root",
            "child_types": ["test-case"],
            "fields": [],
        },
        {
            "kind": "ArtifactType",
            "id": "root-defect",
            "workflow_id": "root",
            "child_types": ["defect"],
            "fields": [],
        },
        {
            "kind": "ArtifactType",
            "id": "test-case",
            "workflow_id": "scrum",
            "parent_types": ["root-quality"],
            "child_types": [],
            "fields": [],
        },
        {
            "kind": "ArtifactType",
            "id": "epic",
            "workflow_id": "scrum",
            "parent_types": ["root-requirement"],
            "child_types": ["feature"],
            "fields": [],
        },
        {
            "kind": "ArtifactType",
            "id": "feature",
            "workflow_id": "scrum",
            "parent_types": ["epic"],
            "child_types": ["user_story"],
            "fields": [],
        },
        {
            "kind": "ArtifactType",
            "id": "user_story",
            "workflow_id": "scrum",
            "parent_types": ["feature"],
            "child_types": [],
            "fields": [],
        },
        {
            "kind": "ArtifactType",
            "id": "defect",
            "workflow_id": "scrum",
            "parent_types": ["root-defect"],
            "child_types": [],
            "fields": [],
        },
        {
            "kind": "LinkType",
            "id": "verifies",
            "from_types": ["test-case"],
            "to_types": ["epic", "feature", "user_story"],
        },
        {
            "kind": "LinkType",
            "id": "blocks",
            "from_types": ["epic", "feature", "user_story"],
            "to_types": ["epic", "feature", "user_story"],
        },
        {
            "kind": "LinkType",
            "id": "impacts",
            "from_types": ["epic", "feature", "user_story"],
            "to_types": ["epic", "feature", "user_story"],
        },
        {
            "kind": "LinkType",
            "id": "affects",
            "from_types": ["defect"],
            "to_types": ["epic", "feature", "user_story"],
        },
        {
            "kind": "LinkType",
            "id": "discovered_in",
            "from_types": ["defect"],
            "to_types": ["test-run"],
        },
    ]
    return with_quality_manifest_bundle({"defs": defs})


def test_validate_scrum_like_bundle_after_quality_merge(scrum_like_merged_bundle: dict[str, Any]) -> None:
    assert validate_link_type_artifact_refs(scrum_like_merged_bundle) == []


def test_all_builtin_seed_templates_link_refs_valid() -> None:
    """Process template seed manifests: every LinkType endpoint must be a defined ArtifactType."""
    for slug, bundle in iter_builtin_merged_manifest_bundles_for_tests():
        errors = validate_link_type_artifact_refs(bundle)
        assert not errors, f"{slug}: {errors}"

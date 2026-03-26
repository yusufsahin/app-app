"""Tests for manifest-driven task states, tree roots, resolution targets."""

from __future__ import annotations

from alm.artifact.domain.manifest_workflow_metadata import (
    DEFAULT_TREE_ROOT_MAP,
    allowed_task_state_ids,
    get_resolution_target_state_ids,
    get_task_state_options_and_initial,
    get_tree_root_type_map,
    resolve_tree_root_artifact_type,
)


def test_tree_roots_merge_manifest_over_default() -> None:
    bundle = {
        "tree_roots": [
            {"tree_id": "req", "root_artifact_type": "root-requirement"},
            {"tree_id": "custom", "root_artifact_type": "root-custom"},
        ]
    }
    m = get_tree_root_type_map(bundle)
    assert m["req"] == "root-requirement"
    assert m["custom"] == "root-custom"
    assert m["defect"] == DEFAULT_TREE_ROOT_MAP["defect"]


def test_resolve_tree_root() -> None:
    assert resolve_tree_root_artifact_type("requirement", None) == "root-requirement"
    assert resolve_tree_root_artifact_type("quality", None) == "root-quality"
    assert resolve_tree_root_artifact_type("testsuites", None) == "root-testsuites"
    assert resolve_tree_root_artifact_type("unknown", {}) is None


def test_task_states_from_manifest() -> None:
    bundle = {
        "task_workflow_id": "tw",
        "defs": [
            {
                "kind": "Workflow",
                "id": "tw",
                "initial": "open",
                "states": ["open", "shipped"],
                "transitions": [{"from": "open", "to": "shipped", "on": "ship"}],
            },
        ],
    }
    opts, initial = get_task_state_options_and_initial(bundle)
    assert initial == "open"
    assert [o["id"] for o in opts] == ["open", "shipped"]
    assert allowed_task_state_ids(bundle) == frozenset({"open", "shipped"})


def test_resolution_targets_explicit() -> None:
    bundle = {
        "workflows": [
            {
                "id": "w1",
                "states": ["a", "b"],
                "resolution_target_states": ["b"],
            }
        ]
    }
    assert get_resolution_target_state_ids(bundle, "w1") == frozenset({"b"})


def test_resolution_targets_category_completed() -> None:
    bundle = {
        "workflows": [
            {
                "id": "w1",
                "states": [
                    {"id": "open", "category": "proposed"},
                    {"id": "done", "category": "completed"},
                ],
            }
        ]
    }
    assert get_resolution_target_state_ids(bundle, "w1") == frozenset({"done"})

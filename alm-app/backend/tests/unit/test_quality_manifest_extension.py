"""Quality manifest extension: idempotent merge and defs shape."""

from __future__ import annotations

import copy

from alm.artifact.domain.quality_manifest_extension import (
    ensure_quality_folder_workflow,
    merge_quality_domain_into_defs,
    quality_domain_already_in_defs,
    with_quality_manifest_bundle,
)


def _minimal_template_defs() -> list[dict]:
    return [
        {"kind": "Workflow", "id": "task_basic", "initial": "todo", "states": ["todo"], "transitions": []},
        {"kind": "ArtifactType", "id": "root-quality", "workflow_id": "root", "child_types": ["test-case"]},
        {
            "kind": "ArtifactType",
            "id": "test-case",
            "workflow_id": "basic",
            "parent_types": ["root-quality"],
            "fields": [],
        },
        {"kind": "LinkType", "id": "related", "name": "Related"},
    ]


def test_merge_quality_domain_adds_test_suite_and_links() -> None:
    defs = _minimal_template_defs()
    merged = merge_quality_domain_into_defs(copy.deepcopy(defs))
    assert quality_domain_already_in_defs(merged)
    ids = [d.get("id") for d in merged if isinstance(d, dict) and d.get("kind") == "ArtifactType"]
    assert "test-suite" in ids
    assert "quality-folder" in ids
    assert "testsuite-folder" in ids
    assert "root-testsuites" in ids
    wf_ids = [d.get("id") for d in merged if isinstance(d, dict) and d.get("kind") == "Workflow"]
    assert "quality_folder" in wf_ids
    at_by_id = {d.get("id"): d for d in merged if isinstance(d, dict) and d.get("kind") == "ArtifactType"}
    assert at_by_id["testsuite-folder"].get("workflow_id") == "quality_folder"
    assert at_by_id["quality-folder"].get("workflow_id") == "quality_folder"
    link_ids = [d.get("id") for d in merged if isinstance(d, dict) and d.get("kind") == "LinkType"]
    assert "suite_includes_test" in link_ids


def test_merge_quality_domain_idempotent() -> None:
    defs = _minimal_template_defs()
    once = merge_quality_domain_into_defs(copy.deepcopy(defs))
    twice = merge_quality_domain_into_defs(copy.deepcopy(once))
    assert once == twice


def test_with_quality_manifest_bundle() -> None:
    bundle = {"defs": _minimal_template_defs(), "tree_roots": [{"tree_id": "quality", "root_artifact_type": "root-quality"}]}
    out = with_quality_manifest_bundle(bundle)
    assert quality_domain_already_in_defs(out["defs"])
    tree_ids = [str(x.get("tree_id")) for x in out.get("tree_roots", []) if isinstance(x, dict)]
    assert "quality" in tree_ids
    assert "testsuites" in tree_ids


def test_ensure_quality_folder_workflow_upgrades_root_folders() -> None:
    defs: list[dict] = [
        {"kind": "Workflow", "id": "root", "initial": "Active", "states": ["Active"], "transitions": []},
        {"kind": "ArtifactType", "id": "testsuite-folder", "workflow_id": "root"},
        {"kind": "ArtifactType", "id": "quality-folder", "workflow_id": "root"},
    ]
    ensure_quality_folder_workflow(defs)
    wf_ids = [d.get("id") for d in defs if d.get("kind") == "Workflow"]
    assert "quality_folder" in wf_ids
    assert next(d for d in defs if d.get("id") == "testsuite-folder")["workflow_id"] == "quality_folder"
    assert next(d for d in defs if d.get("id") == "quality-folder")["workflow_id"] == "quality_folder"


def test_merge_preserves_when_non_dict_in_defs() -> None:
    defs: list = [{"kind": "ArtifactType", "id": "x"}]
    defs.append("bad")  # type: ignore[arg-type]
    out = merge_quality_domain_into_defs(defs)
    assert out is defs

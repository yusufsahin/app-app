"""Quality manifest extension: idempotent merge and defs shape."""

from __future__ import annotations

import copy

from alm.artifact.domain.quality_manifest_extension import (
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


def test_merge_preserves_when_non_dict_in_defs() -> None:
    defs: list = [{"kind": "ArtifactType", "id": "x"}]
    defs.append("bad")  # type: ignore[arg-type]
    out = merge_quality_domain_into_defs(defs)
    assert out is defs

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from typing import Any

import yaml

ARTIFACT_ID_RE = re.compile(r"^[a-z0-9._-]{3,128}$")
ARTIFACT_TYPES = {"schema", "rule_pack", "manifest_sample", "migration_spec", "compatibility_baseline"}
CRITICALITY_LEVELS = {"critical", "high", "medium", "low"}
CHANGE_TYPES = {"breaking", "non-breaking"}
SUITE_TYPES = {"schema", "semantic", "compat", "migration", "negative", "regression"}


def _load_yaml(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise ValueError(f"File not found: {path}")
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"Top-level YAML object must be a mapping: {path}")
    return data


def _load_optional_yaml(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    if data is None:
        return None
    if not isinstance(data, dict):
        raise ValueError(f"Top-level YAML object must be a mapping: {path}")
    return data


def _validate_artifact_catalog(data: dict[str, Any]) -> set[str]:
    artifacts = data.get("artifacts")
    if not isinstance(artifacts, list) or not artifacts:
        raise ValueError("artifact_catalog.yaml must contain non-empty 'artifacts' list")

    ids: set[str] = set()
    for idx, item in enumerate(artifacts):
        if not isinstance(item, dict):
            raise ValueError(f"artifacts[{idx}] must be a mapping")
        for field in ("artifact_id", "artifact_type", "owner", "criticality", "version_policy"):
            if not item.get(field):
                raise ValueError(f"artifacts[{idx}].{field} is required")

        artifact_id = str(item["artifact_id"])
        if not ARTIFACT_ID_RE.match(artifact_id):
            raise ValueError(f"Invalid artifact_id format: {artifact_id}")
        if artifact_id in ids:
            raise ValueError(f"Duplicate artifact_id: {artifact_id}")
        ids.add(artifact_id)

        if item["artifact_type"] not in ARTIFACT_TYPES:
            raise ValueError(f"Invalid artifact_type for {artifact_id}: {item['artifact_type']}")
        if item["criticality"] not in CRITICALITY_LEVELS:
            raise ValueError(f"Invalid criticality for {artifact_id}: {item['criticality']}")

        if (
            "artifact_version" in item
            and item["artifact_version"] is not None
            and (
                not isinstance(item["artifact_version"], str)
                or not str(item["artifact_version"]).strip()
            )
        ):
            raise ValueError(f"artifacts[{idx}].artifact_version must be a non-empty string when set")

    return ids


def _validate_change_manifest(data: dict[str, Any], artifact_ids: set[str]) -> None:
    for field in ("change_set_id", "change_type", "affected_artifacts", "risk_inputs"):
        if data.get(field) is None:
            raise ValueError(f"change_manifest.yaml missing required field: {field}")

    if data["change_type"] not in CHANGE_TYPES:
        raise ValueError(f"Invalid change_type: {data['change_type']}")

    affected = data["affected_artifacts"]
    if not isinstance(affected, list) or not affected:
        raise ValueError("affected_artifacts must be a non-empty list")
    if len(set(affected)) != len(affected):
        raise ValueError("affected_artifacts must be unique")

    unknown = [a for a in affected if a not in artifact_ids]
    if unknown:
        raise ValueError(f"affected_artifacts contains unknown IDs: {unknown}")

    risk_inputs = data["risk_inputs"]
    if not isinstance(risk_inputs, dict):
        raise ValueError("risk_inputs must be a mapping")
    for field in ("blast_radius", "runtime_impact", "rollback_complexity"):
        if field not in risk_inputs:
            raise ValueError(f"risk_inputs missing required field: {field}")


def _validate_test_manifest(data: dict[str, Any], artifact_ids: set[str]) -> None:
    tests = data.get("tests")
    if not isinstance(tests, list) or not tests:
        raise ValueError("test_manifest.yaml must contain non-empty 'tests' list")

    for idx, item in enumerate(tests):
        if not isinstance(item, dict):
            raise ValueError(f"tests[{idx}] must be a mapping")
        for field in ("test_id", "suite_type", "artifact_refs", "criticality", "automation"):
            if item.get(field) is None:
                raise ValueError(f"tests[{idx}].{field} is required")

        if item["suite_type"] not in SUITE_TYPES:
            raise ValueError(f"Invalid suite_type for tests[{idx}]: {item['suite_type']}")
        if item["criticality"] not in CRITICALITY_LEVELS:
            raise ValueError(f"Invalid criticality for tests[{idx}]: {item['criticality']}")

        refs = item["artifact_refs"]
        if not isinstance(refs, list) or not refs:
            raise ValueError(f"tests[{idx}].artifact_refs must be a non-empty list")
        unknown = [a for a in refs if a not in artifact_ids]
        if unknown:
            raise ValueError(f"tests[{idx}].artifact_refs contains unknown IDs: {unknown}")

        if bool(item["automation"]):
            node_id = item.get("pytest_node_id")
            if not isinstance(node_id, str) or not node_id.strip():
                raise ValueError(f"tests[{idx}].pytest_node_id is required for automated tests")
            classname = item.get("pytest_classname")
            test_name = item.get("pytest_test_name")
            if (classname is None) != (test_name is None):
                raise ValueError(
                    f"tests[{idx}] must provide both pytest_classname and pytest_test_name together"
                )
            for meta_key in ("dsl_version", "rule_pack_version"):
                meta_val = item.get(meta_key)
                if not isinstance(meta_val, str) or not meta_val.strip():
                    raise ValueError(
                        f"tests[{idx}].{meta_key} is required for automated tests (plan: test metadata standard)"
                    )

        risk_level = item.get("risk_level")
        if risk_level is not None and str(risk_level) != str(item.get("criticality")):
            crit = item.get("criticality")
            raise ValueError(
                f"tests[{idx}].risk_level must match criticality when set "
                f"(got {risk_level!r} vs {crit!r})"
            )


def _validate_traceability_graph(
    artifact_catalog: dict[str, Any],
    change_manifest: dict[str, Any],
    graph: dict[str, Any],
    artifact_ids: set[str],
) -> None:
    links = graph.get("links")
    if not isinstance(links, list):
        raise ValueError("traceability_graph.yaml: 'links' must be a list")

    incoming: dict[str, set[str]] = {aid: set() for aid in artifact_ids}
    outgoing: dict[str, set[str]] = {aid: set() for aid in artifact_ids}

    for idx, link in enumerate(links):
        if not isinstance(link, dict):
            raise ValueError(f"links[{idx}] must be a mapping")
        fr = link.get("source_artifact_id")
        to = link.get("target_artifact_id")
        if not fr or not to:
            raise ValueError(f"links[{idx}] requires source_artifact_id and target_artifact_id")
        fr_s, to_s = str(fr), str(to)
        if fr_s not in artifact_ids or to_s not in artifact_ids:
            raise ValueError(f"links[{idx}] references unknown artifact_id")
        outgoing[fr_s].add(to_s)
        incoming[to_s].add(fr_s)

    critical_by_id = {
        str(a.get("artifact_id")): str(a.get("criticality"))
        for a in artifact_catalog.get("artifacts", [])
        if isinstance(a, dict)
    }
    affected = change_manifest.get("affected_artifacts", [])
    if not isinstance(affected, list):
        return

    for aid in affected:
        aid_s = str(aid)
        if critical_by_id.get(aid_s) != "critical":
            continue
        if not incoming.get(aid_s):
            raise ValueError(
                f"Traceability: critical affected artifact {aid_s} has no upstream link in traceability_graph.yaml"
            )
        if not outgoing.get(aid_s):
            raise ValueError(
                f"Traceability: critical affected artifact {aid_s} has no downstream link in traceability_graph.yaml"
            )


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate artifact governance metadata files")
    parser.add_argument("--artifact-catalog", default="alm_meta/artifact_catalog.yaml")
    parser.add_argument("--change-manifest", default="alm_meta/change_manifest.yaml")
    parser.add_argument("--test-manifest", default="alm_meta/test_manifest.yaml")
    parser.add_argument("--traceability-graph", default="alm_meta/traceability_graph.yaml")
    args = parser.parse_args()

    try:
        artifact_catalog = _load_yaml(Path(args.artifact_catalog))
        change_manifest = _load_yaml(Path(args.change_manifest))
        test_manifest = _load_yaml(Path(args.test_manifest))

        artifact_ids = _validate_artifact_catalog(artifact_catalog)
        _validate_change_manifest(change_manifest, artifact_ids)
        _validate_test_manifest(test_manifest, artifact_ids)

        trace_graph = _load_optional_yaml(Path(args.traceability_graph))
        if trace_graph is not None:
            _validate_traceability_graph(artifact_catalog, change_manifest, trace_graph, artifact_ids)
    except ValueError as exc:
        print(f"[validate_artifacts] FAILED: {exc}")
        return 1

    print("[validate_artifacts] OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())

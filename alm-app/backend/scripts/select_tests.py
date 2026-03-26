from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

import yaml

SELECTION_ENGINE_VERSION = "1.2.0"
VALID_TIERS = frozenset({"pr", "nightly", "release"})

ARTIFACT_TO_SUITES: dict[str, set[str]] = {
    "schema": {"schema", "compat"},
    "rule_pack": {"semantic", "compat"},
    "migration_spec": {"migration"},
    "manifest_sample": {"regression"},
    "compatibility_baseline": {"compat"},
}


def _load_yaml(path: Path) -> dict[str, Any]:
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"Top-level YAML object must be a mapping: {path}")
    return data


def _resolve_gate_tier(cli_tier: str | None) -> str:
    raw = (cli_tier or os.environ.get("GATE_TIER") or "pr").strip().lower()
    return raw if raw in VALID_TIERS else "pr"


def _tier_allowed_suites(
    tier: str,
    change_type: str,
    changed_types: set[str],
    computed: set[str],
) -> set[str]:
    """Intersect computed required suites with tier policy; release expands breadth."""
    if tier == "release":
        out = set(computed)
        out.update({"regression", "negative"})
        return out

    if tier == "nightly":
        allow = {"schema", "semantic", "compat", "negative", "migration"}
        return computed & allow

    # pr — hızlı geri bildirim
    allow = {"schema", "semantic"}
    if change_type == "breaking":
        allow.add("compat")
    if "migration_spec" in changed_types:
        allow.add("migration")
    return computed & allow


def main() -> int:
    parser = argparse.ArgumentParser(description="Select test suites for changed artifacts")
    parser.add_argument("--artifact-catalog", default="alm_meta/artifact_catalog.yaml")
    parser.add_argument("--change-manifest", default="alm_meta/change_manifest.yaml")
    parser.add_argument("--test-manifest", default="alm_meta/test_manifest.yaml")
    parser.add_argument("--output", default="artifacts/selected-tests.json")
    parser.add_argument(
        "--gate-tier",
        default=None,
        help="pr | nightly | release (varsayılan: env GATE_TIER veya pr)",
    )
    args = parser.parse_args()

    try:
        artifact_catalog = _load_yaml(Path(args.artifact_catalog))
        change_manifest = _load_yaml(Path(args.change_manifest))
        test_manifest = _load_yaml(Path(args.test_manifest))

        artifacts = artifact_catalog.get("artifacts", [])
        if not isinstance(artifacts, list):
            raise ValueError("artifact_catalog.artifacts must be a list")
        artifact_type_by_id = {str(a.get("artifact_id")): str(a.get("artifact_type")) for a in artifacts}

        changed_ids = change_manifest.get("affected_artifacts", [])
        if not isinstance(changed_ids, list) or not changed_ids:
            raise ValueError("change_manifest.affected_artifacts must be a non-empty list")

        required_suites: set[str] = set()
        for artifact_id in changed_ids:
            artifact_type = artifact_type_by_id.get(str(artifact_id))
            if not artifact_type:
                raise ValueError(f"Unknown affected artifact: {artifact_id}")
            required_suites.update(ARTIFACT_TO_SUITES.get(artifact_type, set()))

        if change_manifest.get("change_type") == "breaking":
            required_suites.add("compat")

        changed_types = {artifact_type_by_id[str(a)] for a in changed_ids}
        if "migration_spec" in changed_types:
            required_suites.add("migration")

        gate_tier = _resolve_gate_tier(args.gate_tier)
        change_type = str(change_manifest.get("change_type", ""))
        tier_suites = _tier_allowed_suites(gate_tier, change_type, changed_types, required_suites)
        tier_suites = set(tier_suites)

        tests = test_manifest.get("tests", [])
        if not isinstance(tests, list):
            raise ValueError("test_manifest.tests must be a list")

        selected_tests = [
            str(t.get("test_id"))
            for t in tests
            if isinstance(t, dict) and str(t.get("suite_type")) in tier_suites
        ]
        selected_tests = sorted(set(selected_tests))

        payload = {
            "change_set_id": change_manifest.get("change_set_id"),
            "gate_tier": gate_tier,
            "selection_engine_version": SELECTION_ENGINE_VERSION,
            "computed_suites": sorted(required_suites),
            "required_suites": sorted(tier_suites),
            "selected_tests": selected_tests,
            "selected_count": len(selected_tests),
        }

        out_path = Path(args.output)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    except (ValueError, OSError) as exc:
        print(f"[select_tests] FAILED: {exc}")
        return 1

    print(f"[select_tests] OK -> {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import yaml


def _load_yaml(path: Path) -> dict[str, Any]:
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"Top-level YAML object must be a mapping: {path}")
    return data


def _load_json(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"Top-level JSON object must be an object: {path}")
    return data


def main() -> int:
    parser = argparse.ArgumentParser(description="Evaluate artifact-native gate preconditions")
    parser.add_argument("--artifact-catalog", default="alm_meta/artifact_catalog.yaml")
    parser.add_argument("--change-manifest", default="alm_meta/change_manifest.yaml")
    parser.add_argument("--test-manifest", default="alm_meta/test_manifest.yaml")
    parser.add_argument("--risk-report", default="artifacts/risk-report.json")
    parser.add_argument("--selected-tests", default="artifacts/selected-tests.json")
    parser.add_argument("--execution-report", default="artifacts/test-execution.json")
    parser.add_argument("--output", default="artifacts/gate-evaluation.json")
    args = parser.parse_args()

    try:
        artifact_catalog = _load_yaml(Path(args.artifact_catalog))
        change_manifest = _load_yaml(Path(args.change_manifest))
        test_manifest = _load_yaml(Path(args.test_manifest))
        risk_report = _load_json(Path(args.risk_report))
        selected_tests = _load_json(Path(args.selected_tests))
        execution_report = _load_json(Path(args.execution_report))

        artifacts = artifact_catalog.get("artifacts", [])
        if not isinstance(artifacts, list):
            raise ValueError("artifact_catalog.artifacts must be a list")
        artifact_by_id = {str(a.get("artifact_id")): a for a in artifacts if isinstance(a, dict)}

        tests = test_manifest.get("tests", [])
        if not isinstance(tests, list):
            raise ValueError("test_manifest.tests must be a list")
        test_by_id = {str(t.get("test_id")): t for t in tests if isinstance(t, dict)}

        changed_ids = change_manifest.get("affected_artifacts", [])
        if not isinstance(changed_ids, list) or not changed_ids:
            raise ValueError("change_manifest.affected_artifacts must be non-empty")

        blockers: list[str] = []
        required_suites = set(selected_tests.get("required_suites", []))
        selected_ids = list(selected_tests.get("selected_tests", []))
        selected_set = set(selected_ids)

        if not selected_ids:
            blockers.append("no_tests_selected")

        change_type = str(change_manifest.get("change_type"))
        if change_type == "breaking" and "compat" not in required_suites:
            blockers.append("compat_required_for_breaking_change")

        changed_types = {
            str(artifact_by_id[a].get("artifact_type"))
            for a in changed_ids
            if a in artifact_by_id
        }
        if "migration_spec" in changed_types and "migration" not in required_suites:
            blockers.append("migration_suite_required")

        critical_changed = any(
            str(artifact_by_id[a].get("criticality")) == "critical"
            for a in changed_ids
            if a in artifact_by_id
        )
        has_selected_critical_test = any(
            str(test_by_id[test_id].get("criticality")) == "critical"
            for test_id in selected_set
            if test_id in test_by_id
        )
        if critical_changed and not has_selected_critical_test:
            blockers.append("critical_artifact_without_critical_tests")

        if execution_report.get("pytest_status") != "passed":
            blockers.append("pytest_failed")

        critical_pass_rate = int(execution_report.get("critical_pass_rate", 0))
        compatibility_suite_status = str(execution_report.get("compatibility_suite_status", "failed"))
        rollback_result = str(execution_report.get("rollback_result", "failed"))

        if critical_changed and critical_pass_rate < 100:
            blockers.append("critical_pass_rate_below_100")
        if change_type == "breaking" and compatibility_suite_status != "passed":
            blockers.append("compatibility_failed")
        if "migration_spec" in changed_types and rollback_result != "passed":
            blockers.append("rollback_missing_or_failed")

        evaluation = {
            "change_set_id": change_manifest.get("change_set_id"),
            "risk_level": risk_report.get("risk_level"),
            "gate_checks": {
                "selected_tests_non_empty": bool(selected_ids),
                "compat_for_breaking": not (change_type == "breaking" and "compat" not in required_suites),
                "migration_suite_for_migration_changes": not (
                    "migration_spec" in changed_types and "migration" not in required_suites
                ),
                "critical_tests_for_critical_artifacts": not (
                    critical_changed and not has_selected_critical_test
                ),
                "pytest_passed": execution_report.get("pytest_status") == "passed",
                "critical_pass_rate_full": (not critical_changed) or critical_pass_rate == 100,
                "compatibility_status_ok": (change_type != "breaking") or compatibility_suite_status == "passed",
                "rollback_status_ok": ("migration_spec" not in changed_types) or rollback_result == "passed",
            },
            "decision": "fail" if blockers else "pass",
            "block_reasons": blockers,
        }

        out_path = Path(args.output)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(evaluation, indent=2), encoding="utf-8")
    except (ValueError, OSError, json.JSONDecodeError) as exc:
        print(f"[run_gates] FAILED: {exc}")
        return 1

    if evaluation["decision"] == "fail":
        print(f"[run_gates] FAIL -> blockers={evaluation['block_reasons']}")
        return 1

    print(f"[run_gates] OK -> {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

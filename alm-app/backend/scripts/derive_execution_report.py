from __future__ import annotations

import argparse
import json
import sys
import xml.etree.ElementTree as ET
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


def _read_junit_summary(path: Path) -> dict[str, int]:
    root = ET.parse(path).getroot()
    tests = 0
    failures = 0
    errors = 0

    if root.tag == "testsuite":
        tests = int(root.attrib.get("tests", "0"))
        failures = int(root.attrib.get("failures", "0"))
        errors = int(root.attrib.get("errors", "0"))
    elif root.tag == "testsuites":
        for suite in root.findall("testsuite"):
            tests += int(suite.attrib.get("tests", "0"))
            failures += int(suite.attrib.get("failures", "0"))
            errors += int(suite.attrib.get("errors", "0"))
    else:
        raise ValueError(f"Unsupported JUnit root tag: {root.tag}")

    return {"tests": tests, "failures": failures, "errors": errors}


def _read_junit_cases(path: Path) -> tuple[dict[str, bool], dict[tuple[str, str], bool]]:
    root = ET.parse(path).getroot()
    case_status_by_node_id: dict[str, bool] = {}
    case_status_by_class_and_name: dict[tuple[str, str], bool] = {}

    testcases: list[ET.Element] = []
    if root.tag == "testsuite":
        testcases = root.findall("testcase")
    elif root.tag == "testsuites":
        for suite in root.findall("testsuite"):
            testcases.extend(suite.findall("testcase"))
    else:
        raise ValueError(f"Unsupported JUnit root tag: {root.tag}")

    for case in testcases:
        classname = case.attrib.get("classname", "")
        name = case.attrib.get("name", "")
        failed = case.find("failure") is not None or case.find("error") is not None
        if classname and name:
            case_status_by_class_and_name[(classname, name)] = not failed

        # Pytest JUnit usually emits dotted classnames; build both dotted and path-like candidates.
        candidates: set[str] = set()
        if classname:
            candidates.add(f"{classname}::{name}")
            candidates.add(f"{classname.replace('.', '/')}::{name}")

            parts = classname.split(".")
            if len(parts) >= 2:
                module_part = ".".join(parts[:-1])
                class_part = parts[-1]
                candidates.add(f"{module_part}::{class_part}::{name}")
                candidates.add(f"{module_part.replace('.', '/')}::{class_part}::{name}")
                candidates.add(f"{module_part.replace('.', '/')}.py::{class_part}::{name}")

        if name:
            candidates.add(name)

        for candidate in candidates:
            case_status_by_node_id[candidate] = not failed

    return case_status_by_node_id, case_status_by_class_and_name


def main() -> int:
    parser = argparse.ArgumentParser(description="Derive gate execution report from JUnit + selected tests")
    parser.add_argument("--junit-xml", default="artifacts/pytest-report.xml")
    parser.add_argument("--selected-tests", default="artifacts/selected-tests.json")
    parser.add_argument("--test-manifest", default="alm_meta/test_manifest.yaml")
    parser.add_argument("--output", default="artifacts/test-execution.json")
    args = parser.parse_args()

    try:
        junit_path = Path(args.junit_xml)
        if not junit_path.exists():
            raise ValueError(f"JUnit XML not found: {junit_path}")

        junit = _read_junit_summary(junit_path)
        case_status_by_node_id, case_status_by_class_and_name = _read_junit_cases(junit_path)
        selected = _load_json(Path(args.selected_tests))
        test_manifest = _load_yaml(Path(args.test_manifest))

        required_suites = set(selected.get("required_suites", []))
        selected_ids = set(selected.get("selected_tests", []))

        tests = test_manifest.get("tests", [])
        if not isinstance(tests, list):
            raise ValueError("test_manifest.tests must be a list")
        selected_tests_manifest = [
            t for t in tests if isinstance(t, dict) and str(t.get("test_id")) in selected_ids
        ]

        selected_critical = [
            t for t in selected_tests_manifest if str(t.get("criticality")) == "critical"
        ]
        selected_compat = [
            t for t in selected_tests_manifest if str(t.get("suite_type")) == "compat"
        ]
        selected_migration = [
            t for t in selected_tests_manifest if str(t.get("suite_type")) == "migration"
        ]

        def _test_passed(test_item: dict[str, Any]) -> bool:
            classname = str(test_item.get("pytest_classname", "")).strip()
            test_name = str(test_item.get("pytest_test_name", "")).strip()
            if classname and test_name:
                return case_status_by_class_and_name.get((classname, test_name), False)

            node_id = str(test_item.get("pytest_node_id", "")).strip()
            if not node_id:
                return False
            return case_status_by_node_id.get(node_id, False)

        selected_critical_count = len(selected_critical)
        selected_critical_passed = sum(1 for t in selected_critical if _test_passed(t))
        selected_compat_count = len(selected_compat)
        selected_compat_passed = sum(1 for t in selected_compat if _test_passed(t))
        selected_migration_count = len(selected_migration)
        selected_migration_passed = sum(1 for t in selected_migration if _test_passed(t))

        pytest_passed = junit["failures"] == 0 and junit["errors"] == 0 and junit["tests"] > 0
        critical_pass_rate = (
            100
            if selected_critical_count == 0
            else int((selected_critical_passed / selected_critical_count) * 100)
        )

        compatibility_suite_status = "not_run"
        if "compat" in required_suites:
            compat_ok = (
                selected_compat_count > 0 and selected_compat_passed == selected_compat_count
            )
            compatibility_suite_status = "passed" if compat_ok else "failed"

        rollback_result = "not_run"
        if "migration" in required_suites:
            mig_ok = (
                selected_migration_count > 0
                and selected_migration_passed == selected_migration_count
            )
            rollback_result = "passed" if mig_ok else "failed"

        report = {
            "gate_tier": selected.get("gate_tier", "pr"),
            "pytest_status": "passed" if pytest_passed else "failed",
            "junit_summary": junit,
            "mapping_mode": "pytest_node_id",
            "critical_selected_tests": selected_critical_count,
            "critical_passed_tests": selected_critical_passed,
            "critical_pass_rate": critical_pass_rate,
            "compatibility_selected_tests": selected_compat_count,
            "compatibility_passed_tests": selected_compat_passed,
            "compatibility_suite_status": compatibility_suite_status,
            "migration_selected_tests": selected_migration_count,
            "migration_passed_tests": selected_migration_passed,
            "rollback_result": rollback_result,
        }

        out_path = Path(args.output)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    except (ValueError, OSError, ET.ParseError, json.JSONDecodeError) as exc:
        print(f"[derive_execution_report] FAILED: {exc}")
        return 1

    print(f"[derive_execution_report] OK -> {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

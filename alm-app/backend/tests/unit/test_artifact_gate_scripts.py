from __future__ import annotations

import json
import subprocess
import sys
import uuid
from pathlib import Path

import yaml

BACKEND_ROOT = Path(__file__).resolve().parents[2]


def _run_script(args: list[str], cwd: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, *args],
        cwd=cwd,
        capture_output=True,
        text=True,
        check=False,
    )


def _new_temp_dir() -> Path:
    base = BACKEND_ROOT / ".pytest_tmp"
    base.mkdir(parents=True, exist_ok=True)
    path = base / f"artifact-gate-{uuid.uuid4().hex}"
    path.mkdir(parents=True, exist_ok=True)
    return path


def test_validate_metadata_passes_with_valid_minimal_files() -> None:
    tmp_path = _new_temp_dir()
    artifact_catalog = {
        "artifacts": [
            {
                "artifact_id": "schema.cycle.v1",
                "artifact_type": "schema",
                "owner": "platform",
                "criticality": "critical",
                "version_policy": "semver",
            }
        ]
    }
    change_manifest = {
        "change_set_id": "cs_test_1",
        "change_type": "non-breaking",
        "affected_artifacts": ["schema.cycle.v1"],
        "risk_inputs": {
            "blast_radius": "single",
            "runtime_impact": "low",
            "rollback_complexity": "low",
        },
    }
    test_manifest = {
        "tests": [
            {
                "test_id": "schema_test_1",
                "suite_type": "schema",
                "artifact_refs": ["schema.cycle.v1"],
                "criticality": "critical",
                "risk_level": "critical",
                "dsl_version": "1.0.0",
                "rule_pack_version": "1.0.0",
                "automation": True,
                "pytest_node_id": "test_schema_1",
                "pytest_classname": "tests.unit.test_schema",
                "pytest_test_name": "test_schema_1",
            }
        ]
    }

    artifact_path = tmp_path / "artifact_catalog.yaml"
    change_path = tmp_path / "change_manifest.yaml"
    test_path = tmp_path / "test_manifest.yaml"
    artifact_path.write_text(yaml.safe_dump(artifact_catalog), encoding="utf-8")
    change_path.write_text(yaml.safe_dump(change_manifest), encoding="utf-8")
    test_path.write_text(yaml.safe_dump(test_manifest), encoding="utf-8")

    missing_trace = tmp_path / "no_traceability.yaml"
    result = _run_script(
        [
            "scripts/validate_metadata.py",
            "--artifact-catalog",
            str(artifact_path),
            "--change-manifest",
            str(change_path),
            "--test-manifest",
            str(test_path),
            "--traceability-graph",
            str(missing_trace),
        ],
        cwd=BACKEND_ROOT,
    )
    assert result.returncode == 0, result.stderr + result.stdout
    assert "[validate_artifacts] OK" in result.stdout


def test_validate_metadata_passes_with_traceability_graph_for_critical_affected() -> None:
    tmp_path = _new_temp_dir()
    artifact_catalog = {
        "artifacts": [
            {
                "artifact_id": "manifest_sample.cycle.minimal",
                "artifact_type": "manifest_sample",
                "owner": "platform",
                "criticality": "medium",
                "version_policy": "semver",
            },
            {
                "artifact_id": "schema.cycle.v1",
                "artifact_type": "schema",
                "owner": "platform",
                "criticality": "critical",
                "version_policy": "semver",
            },
            {
                "artifact_id": "rule_pack.cycle.v1",
                "artifact_type": "rule_pack",
                "owner": "platform",
                "criticality": "high",
                "version_policy": "semver",
            },
        ]
    }
    change_manifest = {
        "change_set_id": "cs_test_trace",
        "change_type": "non-breaking",
        "affected_artifacts": ["schema.cycle.v1"],
        "risk_inputs": {
            "blast_radius": "single",
            "runtime_impact": "low",
            "rollback_complexity": "low",
        },
    }
    test_manifest = {
        "tests": [
            {
                "test_id": "schema_test_trace",
                "suite_type": "schema",
                "artifact_refs": ["schema.cycle.v1"],
                "criticality": "critical",
                "risk_level": "critical",
                "dsl_version": "1.0.0",
                "rule_pack_version": "1.0.0",
                "automation": True,
                "pytest_node_id": "test_schema_trace",
                "pytest_classname": "tests.unit.test_schema",
                "pytest_test_name": "test_schema_trace",
            }
        ]
    }
    traceability = {
        "links": [
            {
                "from_artifact_id": "manifest_sample.cycle.minimal",
                "to_artifact_id": "schema.cycle.v1",
                "link_type": "sample_validates",
            },
            {
                "from_artifact_id": "schema.cycle.v1",
                "to_artifact_id": "rule_pack.cycle.v1",
                "link_type": "schema_to_rules",
            },
        ]
    }

    artifact_path = tmp_path / "artifact_catalog.yaml"
    change_path = tmp_path / "change_manifest.yaml"
    test_path = tmp_path / "test_manifest.yaml"
    trace_path = tmp_path / "traceability_graph.yaml"
    artifact_path.write_text(yaml.safe_dump(artifact_catalog), encoding="utf-8")
    change_path.write_text(yaml.safe_dump(change_manifest), encoding="utf-8")
    test_path.write_text(yaml.safe_dump(test_manifest), encoding="utf-8")
    trace_path.write_text(yaml.safe_dump(traceability), encoding="utf-8")

    result = _run_script(
        [
            "scripts/validate_metadata.py",
            "--artifact-catalog",
            str(artifact_path),
            "--change-manifest",
            str(change_path),
            "--test-manifest",
            str(test_path),
            "--traceability-graph",
            str(trace_path),
        ],
        cwd=BACKEND_ROOT,
    )
    assert result.returncode == 0, result.stderr + result.stdout
    assert "[validate_artifacts] OK" in result.stdout


def test_validate_metadata_fails_when_automation_missing_pytest_node_id() -> None:
    tmp_path = _new_temp_dir()
    artifact_catalog = {
        "artifacts": [
            {
                "artifact_id": "schema.cycle.v1",
                "artifact_type": "schema",
                "owner": "platform",
                "criticality": "critical",
                "version_policy": "semver",
            }
        ]
    }
    change_manifest = {
        "change_set_id": "cs_test_2",
        "change_type": "non-breaking",
        "affected_artifacts": ["schema.cycle.v1"],
        "risk_inputs": {
            "blast_radius": "single",
            "runtime_impact": "low",
            "rollback_complexity": "low",
        },
    }
    test_manifest = {
        "tests": [
            {
                "test_id": "schema_test_2",
                "suite_type": "schema",
                "artifact_refs": ["schema.cycle.v1"],
                "criticality": "critical",
                "automation": True,
            }
        ]
    }

    artifact_path = tmp_path / "artifact_catalog.yaml"
    change_path = tmp_path / "change_manifest.yaml"
    test_path = tmp_path / "test_manifest.yaml"
    artifact_path.write_text(yaml.safe_dump(artifact_catalog), encoding="utf-8")
    change_path.write_text(yaml.safe_dump(change_manifest), encoding="utf-8")
    test_path.write_text(yaml.safe_dump(test_manifest), encoding="utf-8")

    missing_trace = tmp_path / "no_traceability.yaml"
    result = _run_script(
        [
            "scripts/validate_metadata.py",
            "--artifact-catalog",
            str(artifact_path),
            "--change-manifest",
            str(change_path),
            "--test-manifest",
            str(test_path),
            "--traceability-graph",
            str(missing_trace),
        ],
        cwd=BACKEND_ROOT,
    )
    assert result.returncode != 0
    assert "pytest_node_id is required for automated tests" in result.stdout


def test_derive_execution_report_uses_classname_and_test_name_mapping() -> None:
    tmp_path = _new_temp_dir()
    junit_xml = """<?xml version="1.0" encoding="utf-8"?>
<testsuites>
  <testsuite name="pytest" tests="2" failures="0" errors="0">
    <testcase classname="tests.unit.test_sample.TestCase" name="test_critical_ok" time="0.01" />
    <testcase classname="tests.unit.test_sample.TestCase" name="test_compat_ok" time="0.01" />
  </testsuite>
</testsuites>
"""
    selected_tests = {
        "change_set_id": "cs_test_3",
        "required_suites": ["schema", "compat"],
        "selected_tests": ["critical_test", "compat_test"],
        "selected_count": 2,
    }
    test_manifest = {
        "tests": [
            {
                "test_id": "critical_test",
                "suite_type": "schema",
                "artifact_refs": ["schema.cycle.v1"],
                "criticality": "critical",
                "automation": True,
                "pytest_node_id": "test_critical_ok",
                "pytest_classname": "tests.unit.test_sample.TestCase",
                "pytest_test_name": "test_critical_ok",
            },
            {
                "test_id": "compat_test",
                "suite_type": "compat",
                "artifact_refs": ["schema.cycle.v1"],
                "criticality": "high",
                "automation": True,
                "pytest_node_id": "test_compat_ok",
                "pytest_classname": "tests.unit.test_sample.TestCase",
                "pytest_test_name": "test_compat_ok",
            },
        ]
    }

    junit_path = tmp_path / "pytest-report.xml"
    selected_path = tmp_path / "selected-tests.json"
    manifest_path = tmp_path / "test_manifest.yaml"
    output_path = tmp_path / "test-execution.json"
    junit_path.write_text(junit_xml, encoding="utf-8")
    selected_path.write_text(json.dumps(selected_tests), encoding="utf-8")
    manifest_path.write_text(yaml.safe_dump(test_manifest), encoding="utf-8")

    result = _run_script(
        [
            "scripts/derive_execution_report.py",
            "--junit-xml",
            str(junit_path),
            "--selected-tests",
            str(selected_path),
            "--test-manifest",
            str(manifest_path),
            "--output",
            str(output_path),
        ],
        cwd=BACKEND_ROOT,
    )
    assert result.returncode == 0, result.stderr + result.stdout

    report = json.loads(output_path.read_text(encoding="utf-8"))
    assert report["mapping_mode"] == "pytest_node_id"
    assert report["critical_pass_rate"] == 100
    assert report["compatibility_suite_status"] == "passed"

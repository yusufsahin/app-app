"""Tests for revision 040 quality custom_fields JSON migration helpers."""

from __future__ import annotations

from alm.artifact.infrastructure.quality_custom_fields_migration import (
    migrate_run_metrics_json,
    migrate_test_params_rows,
    migrate_test_steps_json,
)


def test_migrate_test_steps_legacy_action_to_kind_step():
    raw = [
        {"stepNumber": 1, "action": "Open app", "expectedResult": "OK"},
        {"stepNumber": 2, "action": "Save", "expected_result": "Done"},
    ]
    out, changed = migrate_test_steps_json(raw)
    assert changed is True
    assert out is not None
    assert len(out) == 2
    assert out[0] == {
        "kind": "step",
        "id": "step-1",
        "stepNumber": 1,
        "name": "Open app",
        "description": "",
        "expectedResult": "OK",
        "status": "not-executed",
    }
    assert out[1]["name"] == "Save"
    assert out[1]["expectedResult"] == "Done"
    assert out[1]["stepNumber"] == 2


def test_migrate_test_steps_call_snake_case():
    raw = [
        {
            "kind": "call",
            "id": "c1",
            "called_test_case_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            "param_overrides": {"env": "staging"},
        }
    ]
    out, changed = migrate_test_steps_json(raw)
    assert changed is True
    assert out is not None
    assert out[0]["kind"] == "call"
    assert out[0]["calledTestCaseId"] == "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    assert out[0]["paramOverrides"] == {"env": "staging"}


def test_migrate_test_steps_v1_unchanged_no_extra_mutation():
    raw = [
        {
            "kind": "step",
            "id": "s1",
            "stepNumber": 1,
            "name": "N",
            "description": "",
            "expectedResult": "",
            "status": "not-executed",
        }
    ]
    out, changed = migrate_test_steps_json(raw)
    assert changed is False
    assert out is not None
    assert out[0]["name"] == "N"


def test_migrate_run_metrics_legacy_summary_to_v1():
    raw = {"passed": 2, "failed": 1, "blocked": 0}
    out, changed = migrate_run_metrics_json(raw, "artifact-id")
    assert changed is True
    assert out is not None
    assert out["v"] == 1
    assert len(out["results"]) == 3
    statuses = [r["status"] for r in out["results"]]
    assert statuses.count("passed") == 2
    assert statuses.count("failed") == 1


def test_migrate_run_metrics_already_v1_skipped():
    raw = {"v": 1, "results": [{"testId": "x", "status": "passed", "stepResults": []}]}
    out, changed = migrate_run_metrics_json(raw, "id")
    assert changed is False
    assert out is None


def test_migrate_test_params_wrap_flat_row():
    raw = {"defs": [{"name": "u"}], "rows": [{"u": "row", "label": "L1"}]}
    out, changed = migrate_test_params_rows(raw)
    assert changed is True
    assert out is not None
    assert out["rows"] == [{"label": "L1", "values": {"u": "row"}}]

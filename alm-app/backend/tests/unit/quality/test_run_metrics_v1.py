import json
import uuid

from alm.quality.application.run_metrics_v1 import (
    metrics_row_for_test_id,
    normalize_execution_status,
    parse_run_metrics_v1_results,
    step_statuses_from_metrics_row,
)


def test_parse_v1_results():
    tid = str(uuid.uuid4())
    cf = {"run_metrics_json": json.dumps({"v": 1, "results": [{"testId": tid, "status": "passed", "stepResults": []}]})}
    rows = parse_run_metrics_v1_results(cf)
    assert len(rows) == 1
    assert rows[0]["testId"] == tid


def test_metrics_row_for_test_id():
    tid = uuid.uuid4()
    cf = {
        "run_metrics_json": {
            "v": 1,
            "results": [
                {"testId": str(uuid.uuid4()), "status": "failed", "stepResults": []},
                {"testId": str(tid), "status": "blocked", "stepResults": [], "paramRowIndex": 2},
            ],
        }
    }
    row = metrics_row_for_test_id(cf, tid)
    assert row is not None
    assert row["status"] == "blocked"
    assert row["paramRowIndex"] == 2


def test_normalize_execution_status():
    assert normalize_execution_status("passed") == "passed"
    assert normalize_execution_status("bad") is None


def test_step_statuses_from_metrics_row():
    row = {
        "stepResults": [
            {"stepId": "s1", "status": "passed"},
            {"stepId": "s2", "status": "bogus"},
        ]
    }
    pairs = step_statuses_from_metrics_row(row)
    assert pairs == [("s1", "passed"), ("s2", "not-executed")]


import uuid

from alm.quality.application.requirement_coverage_rollups import (
    accumulate_subtree_counts_for_leaves,
    worst_status_among_tests,
)


def test_worst_status_empty():
    assert worst_status_among_tests([]) == "not_covered"


def test_worst_status_priority():
    assert worst_status_among_tests(["passed", "failed"]) == "failed"
    assert worst_status_among_tests(["passed", "blocked"]) == "blocked"
    assert worst_status_among_tests(["passed", "not-executed"]) == "not-executed"
    assert worst_status_among_tests([None, "passed"]) == "no_run"
    assert worst_status_among_tests([None]) == "no_run"


def test_accumulate_subtree_counts():
    r = uuid.uuid4()
    f = uuid.uuid4()
    leaf = uuid.uuid4()
    node_ids = {r, f, leaf}
    leaf_ids = {leaf}
    leaf_status = {leaf: "failed"}
    parent_by_id = {leaf: f, f: r, r: None}
    out = accumulate_subtree_counts_for_leaves(node_ids, leaf_ids, leaf_status, parent_by_id)
    assert out[leaf]["failed"] == 1
    assert out[f]["failed"] == 1
    assert out[r]["failed"] == 1

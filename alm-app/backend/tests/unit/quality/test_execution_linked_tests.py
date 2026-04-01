import uuid
from datetime import datetime

from alm.relationship.domain.entities import Relationship
from alm.quality.application.execution_linked_tests import linked_execution_test_ids_for_run

pid = uuid.uuid4()


def _link(
    fid: uuid.UUID,
    tid: uuid.UUID,
    lt: str,
    *,
    so: int | None = None,
    created: str = "2024-01-01T00:00:00+00:00",
) -> Relationship:
    return Relationship(
        project_id=pid,
        source_artifact_id=fid,
        target_artifact_id=tid,
        relationship_type=lt,
        sort_order=so,
        created_at=datetime.fromisoformat(created.replace("Z", "+00:00")),
    )


def test_suite_path_prefers_suite_tests():
    run_id = uuid.uuid4()
    suite_id = uuid.uuid4()
    t1, t2 = uuid.uuid4(), uuid.uuid4()
    outgoing = [
        _link(run_id, suite_id, "run_for_suite", so=0),
        _link(run_id, uuid.uuid4(), "other", so=1),
    ]
    suite_out = {
        suite_id: [
            _link(suite_id, t2, "suite_includes_test", so=1),
            _link(suite_id, t1, "suite_includes_test", so=0),
        ]
    }
    got = linked_execution_test_ids_for_run(outgoing, suite_out)
    assert got == {t1, t2}


def test_fallback_all_outgoing_when_no_suite():
    run_id = uuid.uuid4()
    x, y = uuid.uuid4(), uuid.uuid4()
    outgoing = [_link(run_id, x, "x"), _link(run_id, y, "y")]
    got = linked_execution_test_ids_for_run(outgoing, {})
    assert got == {x, y}


def test_empty_suite_falls_back_to_outgoing():
    run_id = uuid.uuid4()
    suite_id = uuid.uuid4()
    ext = uuid.uuid4()
    outgoing = [_link(run_id, suite_id, "run_for_suite"), _link(run_id, ext, "direct")]
    suite_out = {suite_id: []}
    got = linked_execution_test_ids_for_run(outgoing, suite_out)
    assert got == {suite_id, ext}

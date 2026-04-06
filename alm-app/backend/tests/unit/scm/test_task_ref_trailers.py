import uuid

from alm.scm.application.task_ref_trailers import iter_task_uuids_from_refs_trailers


def test_iter_empty() -> None:
    assert iter_task_uuids_from_refs_trailers("") == []
    assert iter_task_uuids_from_refs_trailers("   ") == []


def test_iter_single_uuid() -> None:
    u = uuid.uuid4()
    assert iter_task_uuids_from_refs_trailers(f"Refs: {u}") == [u]


def test_iter_case_insensitive_key() -> None:
    u = uuid.uuid4()
    assert iter_task_uuids_from_refs_trailers(f"refs:{u}") == [u]
    assert iter_task_uuids_from_refs_trailers(f"REFS: {u}") == [u]


def test_iter_skips_non_uuid_tokens() -> None:
    u = uuid.uuid4()
    text = f"Refs: not-a-uuid, {u}, also-bad"
    assert iter_task_uuids_from_refs_trailers(text) == [u]


def test_iter_multiple_lines_order() -> None:
    u1, u2 = uuid.uuid4(), uuid.uuid4()
    text = f"Intro\nRefs: {u1}\n\nRefs: {u2}\n"
    assert iter_task_uuids_from_refs_trailers(text) == [u1, u2]


def test_iter_dedupes() -> None:
    u = uuid.uuid4()
    text = f"Refs: {u}, {u}"
    assert iter_task_uuids_from_refs_trailers(text) == [u]


def test_iter_task_id_trailer() -> None:
    u = uuid.uuid4()
    assert iter_task_uuids_from_refs_trailers(f"Task-ID: {u}") == [u]
    assert iter_task_uuids_from_refs_trailers(f"task-id:{u}") == [u]


def test_iter_mixed_trailers_document_order() -> None:
    u1, u2 = uuid.uuid4(), uuid.uuid4()
    text = f"Task-ID: {u1}\nRefs: {u2}"
    assert iter_task_uuids_from_refs_trailers(text) == [u1, u2]

"""Resolve which test IDs are in a test-run execution set (matches ManualExecutionPlayerCore)."""

from __future__ import annotations

import uuid

from alm.relationship.domain.entities import Relationship
from alm.relationship.domain.types import RUN_FOR_SUITE, SUITE_INCLUDES_TEST


def _sort_key_link(link: Relationship) -> tuple:
    so = link.sort_order
    ts = link.created_at.timestamp() if link.created_at else 0.0
    return (so is None, so if so is not None else 0, ts)


def ordered_suite_includes_test_ids(outgoing_from_suite: list[Relationship]) -> list[uuid.UUID]:
    """``suite_includes_test`` targets from one suite, same order as frontend ``sortOutgoingSuiteLinks``."""
    rows = [lnk for lnk in outgoing_from_suite if lnk.relationship_type == SUITE_INCLUDES_TEST]
    rows.sort(key=_sort_key_link)
    return [lnk.target_artifact_id for lnk in rows]


def linked_execution_test_ids_for_run(
    outgoing_from_run: list[Relationship],
    suite_outgoing_by_suite_id: dict[uuid.UUID, list[Relationship]],
) -> set[uuid.UUID]:
    """Tests executed in this run per player rules."""
    suite_link = next((lnk for lnk in outgoing_from_run if lnk.relationship_type == RUN_FOR_SUITE), None)
    suite_id = suite_link.target_artifact_id if suite_link else None
    if suite_id is not None:
        suite_out = suite_outgoing_by_suite_id.get(suite_id, [])
        from_suite = ordered_suite_includes_test_ids(suite_out)
        if len(from_suite) > 0:
            return set(from_suite)
    return {lnk.target_artifact_id for lnk in outgoing_from_run}

"""Resolve which test IDs are in a test-run execution set (matches ManualExecutionPlayerCore)."""

from __future__ import annotations

import uuid

from alm.artifact_link.domain.entities import ArtifactLink

RUN_FOR_SUITE = "run_for_suite"
SUITE_INCLUDES_TEST = "suite_includes_test"


def _sort_key_link(link: ArtifactLink) -> tuple:
    so = link.sort_order
    ts = link.created_at.timestamp() if link.created_at else 0.0
    return (so is None, so if so is not None else 0, ts)


def ordered_suite_includes_test_ids(outgoing_from_suite: list[ArtifactLink]) -> list[uuid.UUID]:
    """``suite_includes_test`` targets from one suite, same order as frontend ``sortOutgoingSuiteLinks``."""
    rows = [lnk for lnk in outgoing_from_suite if lnk.link_type == SUITE_INCLUDES_TEST]
    rows.sort(key=_sort_key_link)
    return [lnk.to_artifact_id for lnk in rows]


def linked_execution_test_ids_for_run(
    outgoing_from_run: list[ArtifactLink],
    suite_outgoing_by_suite_id: dict[uuid.UUID, list[ArtifactLink]],
) -> set[uuid.UUID]:
    """Tests executed in this run per player rules."""
    suite_link = next((lnk for lnk in outgoing_from_run if lnk.link_type == RUN_FOR_SUITE), None)
    suite_id = suite_link.to_artifact_id if suite_link else None
    if suite_id is not None:
        suite_out = suite_outgoing_by_suite_id.get(suite_id, [])
        from_suite = ordered_suite_includes_test_ids(suite_out)
        if len(from_suite) > 0:
            return set(from_suite)
    return {lnk.to_artifact_id for lnk in outgoing_from_run}

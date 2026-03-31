"""Pure helpers for requirement coverage histograms (unit-tested)."""

from __future__ import annotations

import uuid
from typing import Literal

CoverageBucket = Literal["passed", "failed", "blocked", "not-executed", "no_run", "not_covered"]

COVERAGE_BUCKETS: tuple[CoverageBucket, ...] = (
    "failed",
    "blocked",
    "not-executed",
    "passed",
    "no_run",
    "not_covered",
)


def worst_status_among_tests(statuses: list[str | None]) -> CoverageBucket:
    """Aggregate multiple linked tests: failed > blocked > not-executed > no_run > passed."""
    if not statuses:
        return "not_covered"
    mapped: list[CoverageBucket] = []
    for s in statuses:
        if s is None:
            mapped.append("no_run")
        elif s in ("passed", "failed", "blocked", "not-executed"):
            mapped.append(s)  # type: ignore[assignment]
        else:
            mapped.append("no_run")
    order: list[CoverageBucket] = ["failed", "blocked", "not-executed", "no_run", "passed"]
    for o in order:
        if o in mapped:
            return o
    return "not_covered"


def empty_subtree_counts() -> dict[str, int]:
    return {b: 0 for b in COVERAGE_BUCKETS}


def accumulate_subtree_counts_for_leaves(
    node_ids: set[uuid.UUID],
    leaf_ids: set[uuid.UUID],
    leaf_status: dict[uuid.UUID, CoverageBucket],
    parent_by_id: dict[uuid.UUID, uuid.UUID | None],
) -> dict[uuid.UUID, dict[str, int]]:
    """Each ancestor of a leaf (within node_ids) gets +1 in that leaf's status bucket."""
    out: dict[uuid.UUID, dict[str, int]] = {n: empty_subtree_counts() for n in node_ids}
    for leaf in leaf_ids:
        if leaf not in node_ids:
            continue
        st = leaf_status.get(leaf, "not_covered")
        cur: uuid.UUID | None = leaf
        while cur is not None:
            if cur in out:
                bucket = out[cur]
                bucket[st] = bucket.get(st, 0) + 1
            cur = parent_by_id.get(cur)  # type: ignore[assignment]
    return out

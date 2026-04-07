"""S4b: which planning types and link types trigger stale traceability on quality artifacts."""

from __future__ import annotations

# Normalized artifact_type values for upstream items whose changes may invalidate linked tests.
UPSTREAM_PLANNING_TYPES: frozenset[str] = frozenset(
    {
        "requirement",
        "root-requirement",
        "feature",
        "epic",
        "user_story",
        "user-story",
        "workitem",
    }
)

# Quality artifacts that receive the stale flag.
LINKED_QUALITY_TYPES: frozenset[str] = frozenset({"test-case", "test-suite"})

# test-case → upstream (target is the planning item).
TEST_TO_UPSTREAM_REL_TYPES: frozenset[str] = frozenset(
    {
        "verifies",
        "validated-by",
        "tested-by",
    }
)

# upstream → test-case / test-suite (source is the planning item).
UPSTREAM_TO_TEST_REL_TYPES: frozenset[str] = frozenset(
    {
        "covers",
        "implements",
    }
)

STALE_REASON_CODE = "upstream_planning_changed"

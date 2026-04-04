"""Regression: demo seed backlog leaf type must match each built-in manifest hierarchy."""

from alm.config.seed import (
    _BUILTIN_MANIFEST_CORE_ADO,
    _BUILTIN_MANIFEST_CORE_AGILE,
    _BUILTIN_MANIFEST_CORE_BASIC,
    _BUILTIN_MANIFEST_CORE_CMMI,
    _BUILTIN_MANIFEST_CORE_KANBAN,
    _BUILTIN_MANIFEST_CORE_SCRUM,
    _demo_planning_leaf_type,
)


def test_demo_planning_leaf_matches_builtin_templates() -> None:
    assert _demo_planning_leaf_type(_BUILTIN_MANIFEST_CORE_BASIC) == "workitem"
    assert _demo_planning_leaf_type(_BUILTIN_MANIFEST_CORE_ADO) == "workitem"
    assert _demo_planning_leaf_type(_BUILTIN_MANIFEST_CORE_SCRUM) == "user_story"
    assert _demo_planning_leaf_type(_BUILTIN_MANIFEST_CORE_KANBAN) == "feature"
    assert _demo_planning_leaf_type(_BUILTIN_MANIFEST_CORE_AGILE) == "user_story"
    assert _demo_planning_leaf_type(_BUILTIN_MANIFEST_CORE_CMMI) == "requirement"

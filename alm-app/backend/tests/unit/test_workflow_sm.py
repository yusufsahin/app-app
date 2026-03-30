"""Unit tests for Statelesspy workflow adapter."""

from __future__ import annotations

from alm.artifact.domain.workflow_sm import (
    get_initial_state,
    get_permitted_triggers,
    get_transition_actions,
    get_transition_guard,
    get_workflow_def,
    is_valid_transition,
)
from tests.support.manifests import (
    TRANSITION_MANIFEST_TRIGGER_LABELS,
    WORKFLOW_SM_BASIC_MANIFEST,
    WORKFLOW_SM_GUARD_FILTER_MANIFEST,
    WORKFLOW_SM_TRANSITION_GUARD_LOOKUP_MANIFEST,
)

SAMPLE_MANIFEST = WORKFLOW_SM_BASIC_MANIFEST


class TestWorkflowSm:
    def test_get_workflow_def_from_defs(self):
        wf = get_workflow_def(SAMPLE_MANIFEST, "requirement")
        assert wf is not None
        assert wf["states"] == ["new", "active", "resolved", "closed"]
        assert wf["initial"] == "new"
        assert len(wf["transitions"]) == 4

    def test_get_workflow_def_unknown_type(self):
        assert get_workflow_def(SAMPLE_MANIFEST, "unknown") is None

    def test_get_initial_state(self):
        assert get_initial_state(SAMPLE_MANIFEST, "requirement") == "new"
        assert get_initial_state(SAMPLE_MANIFEST, "unknown") is None

    def test_is_valid_transition(self):
        assert is_valid_transition(SAMPLE_MANIFEST, "requirement", "new", "active") is True
        assert is_valid_transition(SAMPLE_MANIFEST, "requirement", "active", "resolved") is True
        assert is_valid_transition(SAMPLE_MANIFEST, "requirement", "new", "closed") is False

    def test_get_transition_actions(self):
        actions = get_transition_actions(SAMPLE_MANIFEST, "requirement", "new", "active")
        assert actions["on_enter"] == ["log_transition"]
        assert actions["on_leave"] == []

    def test_get_permitted_triggers(self):
        permitted = get_permitted_triggers(SAMPLE_MANIFEST, "requirement", "new")
        assert set(p[0] for p in permitted) == {"active"}
        assert all(len(p) == 3 for p in permitted)
        assert permitted[0][2] == "active"  # label defaults to to_state
        permitted_active = get_permitted_triggers(SAMPLE_MANIFEST, "requirement", "active")
        assert set(p[0] for p in permitted_active) == {"resolved"}

    def test_get_permitted_triggers_with_trigger_label(self):
        permitted = get_permitted_triggers(TRANSITION_MANIFEST_TRIGGER_LABELS, "requirement", "new")
        assert len(permitted) == 1
        trigger, to_state, label = permitted[0]
        assert trigger == "start"
        assert to_state == "active"
        assert label == "Start"

    def test_get_permitted_triggers_filters_by_guard(self):
        manifest = WORKFLOW_SM_GUARD_FILTER_MANIFEST
        permitted_no_assignee = get_permitted_triggers(
            manifest, "requirement", "new", entity_snapshot={"assignee_id": None}
        )
        assert len(permitted_no_assignee) == 0
        permitted_with_assignee = get_permitted_triggers(
            manifest, "requirement", "new", entity_snapshot={"assignee_id": "user-1"}
        )
        assert len(permitted_with_assignee) == 1
        assert permitted_with_assignee[0][1] == "active"

    def test_get_transition_guard(self):
        manifest = WORKFLOW_SM_TRANSITION_GUARD_LOOKUP_MANIFEST
        assert get_transition_guard(manifest, "requirement", "new", "active") == "assignee_required"
        assert get_transition_guard(manifest, "requirement", "active", "new") is None

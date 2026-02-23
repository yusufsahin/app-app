"""Unit tests for MPC manifest resolver."""
from __future__ import annotations

import pytest

from alm.artifact.domain.mpc_resolver import (
    check_transition_policies,
    get_transition_actions,
    get_workflow_engine,
    is_valid_parent_child,
)


SAMPLE_MANIFEST = {
    "schemaVersion": 1,
    "namespace": "alm",
    "name": "basic",
    "manifestVersion": "1.0.0",
    "defs": [
        {
            "kind": "Workflow",
            "id": "basic",
            "initial": "new",
            "finals": ["closed"],
            "states": ["new", "active", "resolved", "closed"],
            "transitions": [
                {"from": "new", "to": "active", "on": "start", "on_enter": ["log_transition"]},
                {"from": "active", "to": "resolved", "on": "resolve"},
                {"from": "resolved", "to": "closed", "on": "close"},
                {"from": "closed", "to": "active", "on": "reopen"},
            ],
        },
        {
            "kind": "ArtifactType",
            "id": "requirement",
            "workflow_id": "basic",
            "parent_types": ["feature", "epic"],
            "fields": [{"id": "priority", "name": "Priority", "type": "string"}],
        },
        {
            "kind": "ArtifactType",
            "id": "feature",
            "workflow_id": "basic",
            "parent_types": ["epic"],
            "child_types": ["requirement"],
        },
        {
            "kind": "ArtifactType",
            "id": "epic",
            "workflow_id": "basic",
            "child_types": ["feature"],
        },
        {
            "kind": "TransitionPolicy",
            "id": "assignee_active",
            "when": {"state": "active"},
            "require": "assignee",
        },
    ],
}


class TestMpcResolver:
    def test_get_workflow_engine(self):
        engine = get_workflow_engine(SAMPLE_MANIFEST, "requirement")
        assert engine is not None
        assert engine.get_initial_state() == "new"

    def test_get_workflow_engine_unknown_type(self):
        assert get_workflow_engine(SAMPLE_MANIFEST, "unknown") is None

    def test_is_valid_transition(self):
        engine = get_workflow_engine(SAMPLE_MANIFEST, "requirement")
        assert engine.is_valid_transition("new", "active")
        assert engine.is_valid_transition("active", "resolved")
        assert not engine.is_valid_transition("new", "closed")

    def test_is_valid_parent_child(self):
        assert is_valid_parent_child(SAMPLE_MANIFEST, "epic", "feature")
        assert is_valid_parent_child(SAMPLE_MANIFEST, "feature", "requirement")
        assert not is_valid_parent_child(SAMPLE_MANIFEST, "requirement", "epic")

    def test_check_transition_policies_assignee_required(self):
        violations = check_transition_policies(
            SAMPLE_MANIFEST,
            "requirement",
            "active",
            {"assignee_id": None},
        )
        assert len(violations) == 1
        assert "Assignee required" in violations[0]

    def test_check_transition_policies_assignee_ok(self):
        violations = check_transition_policies(
            SAMPLE_MANIFEST,
            "requirement",
            "active",
            {"assignee_id": "user-123"},
        )
        assert len(violations) == 0

    def test_get_transition_actions(self):
        actions = get_transition_actions(SAMPLE_MANIFEST, "requirement", "new", "active")
        assert actions["on_enter"] == ["log_transition"]
        assert actions["on_leave"] == []

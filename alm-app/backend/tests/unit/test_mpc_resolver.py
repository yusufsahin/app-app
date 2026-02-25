"""Unit tests for MPC manifest resolver."""
from __future__ import annotations

import uuid

import pytest

from alm.artifact.domain.mpc_resolver import (
    acl_check,
    check_transition_policies,
    evaluate_transition_policy,
    get_manifest_ast,
    get_transition_actions,
    get_workflow_engine,
    is_valid_parent_child,
    manifest_defs_to_flat,
    _to_ast,
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
            "active",
            {"assignee_id": None},
            type_id="requirement",
        )
        assert len(violations) == 1
        assert "Assignee required" in violations[0]

    def test_check_transition_policies_assignee_ok(self):
        violations = check_transition_policies(
            SAMPLE_MANIFEST,
            "active",
            {"assignee_id": "user-123"},
            type_id="requirement",
        )
        assert len(violations) == 0

    def test_get_transition_actions(self):
        actions = get_transition_actions(SAMPLE_MANIFEST, "requirement", "new", "active")
        assert actions["on_enter"] == ["log_transition"]
        assert actions["on_leave"] == []

    def test_manifest_defs_to_flat(self):
        flat = manifest_defs_to_flat(SAMPLE_MANIFEST)
        assert len(flat["workflows"]) == 1
        assert flat["workflows"][0]["id"] == "basic"
        assert len(flat["workflows"][0]["transitions"]) == 4
        assert flat["workflows"][0]["transitions"][0] == {"from": "new", "to": "active"}

        assert len(flat["artifact_types"]) == 3
        at_ids = {at["id"] for at in flat["artifact_types"]}
        assert at_ids == {"requirement", "feature", "epic"}
        req = next(at for at in flat["artifact_types"] if at["id"] == "requirement")
        assert req["name"] == "Requirement"
        assert req["workflow_id"] == "basic"
        assert req["parent_types"] == ["feature", "epic"]
        assert len(req["fields"]) == 1
        assert req["fields"][0]["id"] == "priority"

        assert "link_types" in flat
        assert flat["link_types"] == []

    def test_manifest_defs_to_flat_link_types(self):
        manifest = {
            "defs": [
                {"kind": "LinkType", "id": "blocks", "name": "Blocks"},
                {"kind": "LinkType", "id": "relates-to", "name": "Relates To"},
            ],
        }
        flat = manifest_defs_to_flat(manifest)
        assert flat["link_types"] == [
            {"id": "blocks", "name": "Blocks"},
            {"id": "relates-to", "name": "Relates To"},
        ]
        assert flat["workflows"] == []
        assert flat["artifact_types"] == []

    def test_manifest_defs_to_flat_empty_and_flat_format(self):
        assert manifest_defs_to_flat(None) == {"workflows": [], "artifact_types": [], "link_types": []}
        assert manifest_defs_to_flat({}) == {"workflows": [], "artifact_types": [], "link_types": []}
        flat = manifest_defs_to_flat({"workflows": [], "artifact_types": [], "link_types": [{"id": "related", "name": "Related"}]})
        assert flat["link_types"] == [{"id": "related", "name": "Related"}]

    def test_evaluate_transition_policy_allow(self):
        """D1: PolicyEngine returns allow when no Policy defs match or deny."""
        version_id = uuid.uuid4()
        ast = get_manifest_ast(version_id, SAMPLE_MANIFEST)
        event = {
            "kind": "transition",
            "name": "artifact.transition",
            "object": {"id": "a1", "type": "artifact", "state": "new"},
            "actor": {"id": "u1", "type": "user", "roles": ["member"]},
            "context": {"from_state": "new", "to_state": "active", "project_id": "p1"},
            "timestamp": "2025-01-01T12:00:00Z",
        }
        allow, violations = evaluate_transition_policy(ast, event, actor_roles=["member"])
        assert allow is True
        assert violations == []

    def test_evaluate_transition_policy_no_actor_roles(self):
        """evaluate_transition_policy accepts None actor_roles."""
        version_id = uuid.uuid4()
        ast = get_manifest_ast(version_id, SAMPLE_MANIFEST)
        event = {"kind": "transition", "name": "artifact.transition"}
        allow, violations = evaluate_transition_policy(ast, event, actor_roles=None)
        assert allow is True
        assert violations == []

    def test_acl_check_returns_tuple(self):
        """P2: acl_check returns (allowed, reasons); when MPC ACL missing, allows."""
        ast = _to_ast(SAMPLE_MANIFEST)
        allowed, reasons = acl_check(ast, "read", "artifact", [])
        assert isinstance(allowed, bool)
        assert isinstance(reasons, list)
        assert allowed is True
        assert reasons == []

    def test_acl_check_manifest_read(self):
        """P2: acl_check(ast, 'read', 'manifest', roles) returns (bool, list)."""
        ast = _to_ast(SAMPLE_MANIFEST)
        allowed, reasons = acl_check(ast, "read", "manifest", ["member"])
        assert isinstance(allowed, bool)
        assert isinstance(reasons, list)

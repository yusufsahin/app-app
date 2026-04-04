"""Unit tests for MPC manifest resolver."""

from __future__ import annotations

import uuid

from alm.artifact.domain.mpc_resolver import (
    _HAS_MPC,
    _to_ast,
    acl_check,
    build_artifact_transition_policy_event,
    check_transition_policies,
    evaluate_transition_policy,
    get_manifest_ast,
    get_transition_actions,
    is_valid_parent_child,
    manifest_defs_to_flat,
)
from alm.artifact.domain.workflow_sm import get_initial_state, is_valid_transition
from tests.support.manifests import (
    MANIFEST_DEFS_LINK_TYPE_BLOCKS_RICH,
    MANIFEST_DEFS_LINK_TYPES_SIMPLE,
    MANIFEST_DEFS_WORKFLOW_TRIGGER_LABEL,
    MPC_RESOLVER_SAMPLE_MANIFEST,
)

SAMPLE_MANIFEST = MPC_RESOLVER_SAMPLE_MANIFEST


class TestMpcResolver:
    def test_workflow_initial_state(self):
        """Initial state from workflow_sm (MPC WorkflowEngine when mpc is installed)."""
        assert get_initial_state(SAMPLE_MANIFEST, "requirement") == "new"
        assert get_initial_state(SAMPLE_MANIFEST, "unknown") is None

    def test_is_valid_transition(self):
        """Transition validity from workflow_sm / MPC WorkflowEngine graph."""
        assert is_valid_transition(SAMPLE_MANIFEST, "requirement", "new", "active")
        assert is_valid_transition(SAMPLE_MANIFEST, "requirement", "active", "resolved")
        assert not is_valid_transition(SAMPLE_MANIFEST, "requirement", "new", "closed")

    def test_is_valid_parent_child(self):
        assert is_valid_parent_child(SAMPLE_MANIFEST, "epic", "feature")
        assert is_valid_parent_child(SAMPLE_MANIFEST, "feature", "requirement")
        assert not is_valid_parent_child(SAMPLE_MANIFEST, "requirement", "epic")

    def test_is_valid_parent_child_false_when_parent_disallows_create(self):
        m = {
            "defs": [
                {
                    "kind": "Workflow",
                    "id": "basic",
                    "initial": "new",
                    "states": ["new", "active"],
                    "transitions": [{"from": "new", "to": "active", "on": "go"}],
                },
                {
                    "kind": "ArtifactType",
                    "id": "epic",
                    "workflow_id": "basic",
                    "allow_create_children": False,
                    "child_types": ["feature"],
                },
                {
                    "kind": "ArtifactType",
                    "id": "feature",
                    "workflow_id": "basic",
                    "parent_types": ["epic"],
                    "child_types": [],
                },
            ],
        }
        assert not is_valid_parent_child(m, "epic", "feature")

    def test_check_transition_policies_assignee_required(self):
        ast = get_manifest_ast(uuid.uuid4(), SAMPLE_MANIFEST)
        event = {
            "object": {"assignee_id": None},
            "context": {"to_state": "active"},
        }
        msgs = check_transition_policies(ast, event)
        assert msgs
        assert "assignee" in " ".join(msgs).lower()

    def test_check_transition_policies_assignee_ok(self):
        ast = get_manifest_ast(uuid.uuid4(), SAMPLE_MANIFEST)
        event = {
            "object": {"assignee_id": "u1"},
            "context": {"to_state": "active"},
        }
        assert check_transition_policies(ast, event) == []

    def test_build_artifact_transition_policy_event_shape(self):
        pid = uuid.uuid4()
        tid = uuid.uuid4()
        uid = uuid.uuid4()
        e = build_artifact_transition_policy_event(
            artifact_id=pid,
            artifact_type="requirement",
            from_state="new",
            to_state="active",
            assignee_id=None,
            custom_fields={"k": "v"},
            project_id=tid,
            tenant_id=tid,
            updated_by=uid,
            actor_roles=("editor",),
        )
        assert e["kind"] == "transition"
        assert e["object"]["id"] == str(pid)
        assert e["context"]["to_state"] == "active"
        assert e["actor"]["roles"] == ["editor"]

    def test_evaluate_transition_policy_violation(self):
        ast = get_manifest_ast(uuid.uuid4(), SAMPLE_MANIFEST)
        event = {
            "kind": "transition",
            "name": "artifact.transition",
            "object": {"id": "a1", "type": "artifact", "state": "active", "assignee_id": None},
            "actor": {"id": "u1", "type": "user", "roles": ["member"]},
            "context": {"from_state": "new", "to_state": "active", "project_id": "p1"},
            "timestamp": "2025-01-01T12:00:00Z",
        }
        # In MPC v0.1.0, TransitionPolicy (which is a kind of Policy) will be evaluated.
        # Our mock/sample manifest has a TransitionPolicy requiring assignee.
        allow, violations = evaluate_transition_policy(ast, event, actor_roles=["member"])
        assert allow is False
        assert len(violations) > 0

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

        assert "relationship_types" in flat
        assert flat["relationship_types"] == []

    def test_manifest_defs_to_flat_relationship_types(self):
        flat = manifest_defs_to_flat(MANIFEST_DEFS_LINK_TYPES_SIMPLE)
        assert flat["relationship_types"] == [
            {"id": "blocks", "name": "Blocks"},
            {"id": "relates-to", "name": "Relates To"},
        ]
        assert flat["workflows"] == []
        assert flat["artifact_types"] == []

    def test_manifest_defs_to_flat_relationship_type_optional_metadata(self):
        flat = manifest_defs_to_flat(MANIFEST_DEFS_LINK_TYPE_BLOCKS_RICH)
        assert flat["relationship_types"] == [
            {
                "id": "blocks",
                "name": "Blocks",
                "direction": "directed",
                "cardinality": "many-to-many",
                "from_types": ["feature"],
                "to_types": ["requirement"],
                "description": "Feature blocks requirement",
            },
        ]

    def test_manifest_defs_to_flat_preserves_trigger_and_label(self):
        flat = manifest_defs_to_flat(MANIFEST_DEFS_WORKFLOW_TRIGGER_LABEL)
        assert len(flat["workflows"]) == 1
        assert flat["workflows"][0]["transitions"][0] == {
            "from": "new",
            "to": "active",
            "trigger": "start",
            "trigger_label": "Start",
        }

    def test_manifest_defs_to_flat_preserves_allow_create_children_and_flags(self):
        flat = manifest_defs_to_flat(
            {
                "defs": [
                    {
                        "kind": "ArtifactType",
                        "id": "epic",
                        "workflow_id": "basic",
                        "child_types": ["feature"],
                        "allow_create_children": False,
                        "flags": {"allow_create_children": False},
                    },
                ],
            }
        )
        epic = next(at for at in flat["artifact_types"] if at["id"] == "epic")
        assert epic["allow_create_children"] is False
        assert epic["flags"]["allow_create_children"] is False

    def test_manifest_defs_to_flat_preserves_allows_children_false(self):
        flat = manifest_defs_to_flat(
            {
                "defs": [
                    {
                        "kind": "ArtifactType",
                        "id": "folder",
                        "workflow_id": "basic",
                        "child_types": ["item"],
                        "allows_children": False,
                    },
                ],
            }
        )
        folder = next(at for at in flat["artifact_types"] if at["id"] == "folder")
        assert folder["allows_children"] is False

    def test_manifest_defs_to_flat_empty_and_flat_format(self):
        assert manifest_defs_to_flat(None) == {"workflows": [], "artifact_types": [], "relationship_types": []}
        assert manifest_defs_to_flat({}) == {"workflows": [], "artifact_types": [], "relationship_types": []}
        flat = manifest_defs_to_flat(
            {"workflows": [], "artifact_types": [], "relationship_types": [{"id": "related", "name": "Related"}]}
        )
        assert flat["relationship_types"] == [{"id": "related", "name": "Related"}]

    def test_evaluate_transition_policy_allow(self):
        """D1: PolicyEngine returns allow when no Policy defs match or deny."""
        version_id = uuid.uuid4()
        ast = get_manifest_ast(version_id, SAMPLE_MANIFEST)
        event = {
            "kind": "transition",
            "name": "artifact.transition",
            "object": {
                "id": "a1",
                "type": "artifact",
                "state": "new",
                "assignee_id": "550e8400-e29b-41d4-a716-446655440000",
            },
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
        if not _HAS_MPC:
            assert allowed is True
            assert reasons == []

    def test_acl_check_manifest_read(self):
        """P2: acl_check(ast, 'read', 'manifest', roles) returns (bool, list)."""
        ast = _to_ast(SAMPLE_MANIFEST)
        allowed, reasons = acl_check(ast, "read", "manifest", ["member"])
        assert isinstance(allowed, bool)
        assert isinstance(reasons, list)

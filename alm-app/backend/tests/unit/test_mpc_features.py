"""Unit tests for consolidated MPC features in alm-app."""

from alm.artifact.domain.mpc_resolver import _to_ast, acl_check, redact_data
from alm.artifact.domain.workflow_sm import (
    get_permitted_triggers,
    get_workflow_engine,
    is_valid_transition,
)

SAMPLE_MANIFEST = {
    "schemaVersion": 1,
    "namespace": "alm",
    "name": "test",
    "manifestVersion": "1.0.0",
    "defs": [
        {
            "kind": "ACL",
            "id": "acl_read",
            "action": "read",
            "resource": "artifact",
            "roles": ["viewer"],
            "effect": "allow",
        },
        {
            "kind": "ACL",
            "id": "acl_update",
            "action": "update",
            "resource": "artifact",
            "roles": ["editor"],
            "effect": "allow",
        },
        {
            "kind": "ACL",
            "id": "acl_delete",
            "action": "delete",
            "resource": "artifact",
            "roles": ["admin"],
            "effect": "allow",
        },
        {
            "kind": "Redact",
            "id": "artifact_redact",
            "rules": [
                {"field": "internal_notes", "roles": ["viewer"], "effect": "mask"},
                {"field": "confidential_data", "roles": ["viewer", "editor"], "effect": "mask"},
            ],
        },
    ],
}


def test_redact_data_viewer():
    ast = _to_ast(SAMPLE_MANIFEST)
    data = {
        "title": "Bug Report",
        "internal_notes": "Sensitive notes",
        "confidential_data": "Secret stuff",
        "public_info": "Everyone can see",
    }
    redacted = redact_data(ast, data, actor_roles=["viewer"])

    assert redacted["title"] == "Bug Report"
    assert redacted["public_info"] == "Everyone can see"
    # Masked fields
    assert "internal_notes" not in redacted or redacted["internal_notes"] != "Sensitive notes"
    assert "confidential_data" not in redacted or redacted["confidential_data"] != "Secret stuff"


def test_redact_data_admin():
    ast = _to_ast(SAMPLE_MANIFEST)
    data = {"internal_notes": "notes"}
    redacted = redact_data(ast, data, actor_roles=["admin"])
    assert redacted["internal_notes"] == "notes"


def test_acl_check_viewer():
    ast = _to_ast(SAMPLE_MANIFEST)
    allowed, reasons = acl_check(ast, "read", "artifact", ["viewer"])
    assert allowed is True

    allowed, reasons = acl_check(ast, "update", "artifact", ["viewer"])
    assert allowed is False


def test_acl_check_admin():
    ast = _to_ast(SAMPLE_MANIFEST)
    allowed, reasons = acl_check(ast, "delete", "artifact", ["admin"])
    assert allowed is True


# ---------------------------------------------------------------------------
# Workflow engine tests
# ---------------------------------------------------------------------------

WORKFLOW_MANIFEST = {
    "schemaVersion": 1,
    "namespace": "alm",
    "name": "workflow",
    "manifestVersion": "1.0.0",
    "defs": [
        {"kind": "ArtifactType", "id": "requirement", "workflow_id": "req_flow"},
        {
            "kind": "Workflow",
            "id": "req_flow",
            "initial": "open",
            "states": ["open", "in_progress", "closed"],
            "finals": ["closed"],
            "transitions": [
                {"from": "open", "on": "start", "to": "in_progress"},
                {"from": "in_progress", "on": "close", "to": "closed"},
                {"from": "open", "on": "close", "to": "closed"},
            ],
        },
    ],
}


def test_workflow_engine_builds_from_manifest():
    engine = get_workflow_engine(WORKFLOW_MANIFEST, "requirement")
    assert engine is not None
    assert engine.initial_state == "open"


def test_workflow_is_valid_transition():
    # Defensive check: if engine has different method name or structure
    assert is_valid_transition(WORKFLOW_MANIFEST, "requirement", "open", "in_progress") is True
    assert is_valid_transition(WORKFLOW_MANIFEST, "requirement", "open", "closed") is True
    assert is_valid_transition(WORKFLOW_MANIFEST, "requirement", "closed", "open") is False


def test_get_permitted_triggers_from_open():
    triggers = get_permitted_triggers(WORKFLOW_MANIFEST, "requirement", "open")
    trigger_names = [t[0] for t in triggers]
    assert "start" in trigger_names
    assert "close" in trigger_names


def test_workflow_engine_unknown_type_returns_none():
    engine = get_workflow_engine(WORKFLOW_MANIFEST, "nonexistent_type")
    assert engine is None

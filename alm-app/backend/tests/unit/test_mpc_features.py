"""Unit tests for consolidated MPC features in alm-app."""

import pytest
from alm.artifact.domain.mpc_resolver import redact_data, acl_check, _to_ast
from alm.artifact.domain.workflow_sm import _normalize_guard

SAMPLE_MANIFEST = {
    "defs": [
        {
            "kind": "ACL",
            "id": "artifact_acl",
            "rules": [
                {"action": "read", "resource": "artifact", "role": "viewer", "effect": "allow"},
                {"action": "update", "resource": "artifact", "role": "editor", "effect": "allow"},
                {"action": "delete", "resource": "artifact", "role": "admin", "effect": "allow"},
            ]
        },
        {
            "kind": "Redact",
            "id": "artifact_redact",
            "rules": [
                {"field": "internal_notes", "role": "viewer", "effect": "mask"},
                {"field": "confidential_data", "role": ["viewer", "editor"], "effect": "mask"},
            ]
        }
    ]
}

def test_redact_data_viewer():
    ast = _to_ast(SAMPLE_MANIFEST)
    data = {
        "title": "Bug Report",
        "internal_notes": "Sensitive notes",
        "confidential_data": "Secret stuff",
        "public_info": "Everyone can see"
    }
    redacted = redact_data(ast, data, actor_roles=["viewer"])
    
    assert redacted["title"] == "Bug Report"
    assert redacted["public_info"] == "Everyone can see"
    # Masked fields (MPC Redactor default mask is often '***' or empty depending on version, 
    # but here we just check they are changed)
    assert redacted["internal_notes"] != "Sensitive notes"
    assert redacted["confidential_data"] != "Secret stuff"

def test_redact_data_admin():
    ast = _to_ast(SAMPLE_MANIFEST)
    data = {
        "internal_notes": "Sensitive notes",
        "confidential_data": "Secret stuff",
    }
    # Admin has no mask rules defined, so they see everything
    redacted = redact_data(ast, data, actor_roles=["admin"])
    
    assert redacted["internal_notes"] == "Sensitive notes"
    assert redacted["confidential_data"] == "Secret stuff"

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

def test_guard_normalization_legacy_string():
    # Test 'assignee_required' -> 'bool(assignee_id)'
    assert _normalize_guard("assignee_required") == "bool(assignee_id)"
    # Test other strings remain unchanged
    assert _normalize_guard("custom_expr == 1") == "custom_expr == 1"

def test_guard_normalization_legacy_dict():
    # assignee_required
    assert _normalize_guard({"type": "assignee_required"}) == "bool(assignee_id)"
    
    # field_present
    assert _normalize_guard({"type": "field_present", "field": "state_reason"}) == "state_reason != None"
    
    # field_equals
    assert _normalize_guard({"type": "field_equals", "field": "state", "value": "done"}) == "state == 'done'"
    assert _normalize_guard({"type": "field_equals", "field": "count", "value": 10}) == "count == 10"

def test_guard_normalization_none():
    assert _normalize_guard(None) is None

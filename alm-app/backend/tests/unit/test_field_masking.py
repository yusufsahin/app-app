"""Unit tests for D1 field masking (artifact response ACL)."""

from __future__ import annotations

from alm.shared.infrastructure.security.field_masking import (
    SENSITIVE_CUSTOM_FIELD_KEYS,
    allowed_actions_for_artifact,
    mask_artifact_response,
)


class TestMaskArtifactResponse:
    def test_passthrough_when_has_sensitive_permission(self):
        data = {"custom_fields": {"internal_notes": "secret", "priority": "high"}}
        out = mask_artifact_response(data, ["artifact:read_sensitive"])
        assert out["custom_fields"] == {"internal_notes": "secret", "priority": "high"}

    def test_passthrough_with_artifact_wildcard(self):
        data = {"custom_fields": {"internal_notes": "x"}}
        out = mask_artifact_response(data, ["artifact:*"])
        assert out["custom_fields"] == {"internal_notes": "x"}

    def test_masks_sensitive_custom_fields_without_permission(self):
        data = {"custom_fields": {"internal_notes": "secret", "priority": "high", "confidential": "yes"}}
        out = mask_artifact_response(data, ["artifact:read"])
        assert "internal_notes" not in out["custom_fields"]
        assert "confidential" not in out["custom_fields"]
        assert out["custom_fields"]["priority"] == "high"

    def test_empty_custom_fields_unchanged(self):
        data = {"custom_fields": {}}
        out = mask_artifact_response(data, [])
        assert out["custom_fields"] == {}

    def test_non_sensitive_keys_unchanged(self):
        data = {"custom_fields": {"priority": "p1", "story_points": 3}}
        out = mask_artifact_response(data, [])
        assert out["custom_fields"] == {"priority": "p1", "story_points": 3}

    def test_sensitive_keys_constant(self):
        assert "internal_notes" in SENSITIVE_CUSTOM_FIELD_KEYS
        assert "confidential" in SENSITIVE_CUSTOM_FIELD_KEYS


class TestAllowedActionsForArtifact:
    def test_maps_permissions_to_actions(self):
        actions = allowed_actions_for_artifact(
            ["artifact:read", "artifact:update", "artifact:transition"],
        )
        assert "read" in actions
        assert "update" in actions
        assert "restore" in actions  # restore comes with update
        assert "transition" in actions
        assert "delete" not in actions

    def test_empty_privileges(self):
        assert allowed_actions_for_artifact([]) == []

    def test_wildcard_grants_all(self):
        actions = allowed_actions_for_artifact(["*"])
        assert "read" in actions
        assert "update" in actions
        assert "delete" in actions
        assert "transition" in actions
        assert "create" in actions
        assert "comment" in actions
        assert "restore" in actions

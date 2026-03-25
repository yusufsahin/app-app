"""Unit tests for D1 field masking (artifact response ACL)."""

from __future__ import annotations

import uuid

from alm.shared.infrastructure.security.field_masking import (
    SENSITIVE_CUSTOM_FIELD_KEYS,
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

    async def test_mask_artifact_for_user(self):
        from unittest.mock import AsyncMock, patch

        from alm.artifact.api.schemas import ArtifactResponse
        from alm.shared.infrastructure.security.dependencies import CurrentUser

        resp = ArtifactResponse(
            id=uuid.uuid4(),
            project_id=uuid.uuid4(),
            artifact_type="task",
            title="T1",
            description="",
            state="new",
            assignee_id=None,
            parent_id=None,
            custom_fields={"internal_notes": "secret", "priority": "high"},
        )
        user = CurrentUser(id=uuid.uuid4(), tenant_id=uuid.uuid4(), roles=["viewer"])

        with patch(
            "alm.shared.infrastructure.security.dependencies.get_user_privileges",
            AsyncMock(return_value=["artifact:read"]),
        ):
            from alm.shared.infrastructure.security.field_masking import mask_artifact_for_user

            out = await mask_artifact_for_user(resp, user)
            assert "internal_notes" not in out.custom_fields
            assert out.custom_fields["priority"] == "high"
            assert "read" in out.allowed_actions

    async def test_mask_artifact_list_for_user(self):
        from unittest.mock import AsyncMock, patch

        from alm.artifact.api.schemas import ArtifactResponse
        from alm.shared.infrastructure.security.dependencies import CurrentUser

        items = [
            ArtifactResponse(
                id=uuid.uuid4(),
                project_id=uuid.uuid4(),
                artifact_type="t",
                title="T1",
                description="",
                state="n",
                assignee_id=None,
                parent_id=None,
                custom_fields={"internal_notes": "s"},
            ),
            ArtifactResponse(
                id=uuid.uuid4(),
                project_id=uuid.uuid4(),
                artifact_type="t",
                title="T2",
                description="",
                state="n",
                assignee_id=None,
                parent_id=None,
                custom_fields={"priority": "h"},
            ),
        ]
        user = CurrentUser(id=uuid.uuid4(), tenant_id=uuid.uuid4(), roles=["viewer"])

        with patch(
            "alm.shared.infrastructure.security.dependencies.get_user_privileges",
            AsyncMock(return_value=["artifact:read"]),
        ):
            from alm.shared.infrastructure.security.field_masking import mask_artifact_list_for_user

            out = await mask_artifact_list_for_user(items, user)
            assert len(out) == 2
            assert "internal_notes" not in out[0].custom_fields
            assert out[1].custom_fields["priority"] == "h"

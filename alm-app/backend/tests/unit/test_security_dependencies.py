"""Unit tests for security dependencies (_matches_permission)."""

from __future__ import annotations

from alm.shared.infrastructure.security.dependencies import _matches_permission


class TestMatchesPermission:
    """Tests for _matches_permission (used by require_permission and GuardPort)."""

    def test_wildcard_grants_all(self) -> None:
        assert _matches_permission(["*"], "artifact:read") is True
        assert _matches_permission(["*"], "manifest:update") is True

    def test_exact_match(self) -> None:
        assert _matches_permission(["artifact:read"], "artifact:read") is True
        assert _matches_permission(["artifact:read", "manifest:update"], "manifest:update") is True

    def test_resource_wildcard(self) -> None:
        assert _matches_permission(["artifact:*"], "artifact:read") is True
        assert _matches_permission(["artifact:*"], "artifact:update") is True
        assert _matches_permission(["artifact:*"], "artifact:delete") is True

    def test_no_match(self) -> None:
        assert _matches_permission([], "artifact:read") is False
        assert _matches_permission(["manifest:read"], "artifact:read") is False
        assert _matches_permission(["artifact:read"], "artifact:update") is False
        assert _matches_permission(["other:*"], "artifact:read") is False

    def test_empty_codes(self) -> None:
        assert _matches_permission([], "artifact:read") is False

    def test_colon_format(self) -> None:
        assert _matches_permission(["resource:action"], "resource:action") is True
        assert _matches_permission(["resource:*"], "resource:other") is True

"""Unit tests: saved-query route UUID parsing helper."""

from __future__ import annotations

import uuid

from alm.orgs.api.routes_saved_queries import _parse_uuid


def test_parse_uuid_none() -> None:
    assert _parse_uuid(None) is None


def test_parse_uuid_uuid_instance() -> None:
    u = uuid.uuid4()
    assert _parse_uuid(u) is u


def test_parse_uuid_valid_string() -> None:
    u = uuid.uuid4()
    assert _parse_uuid(str(u)) == u


def test_parse_uuid_invalid_string() -> None:
    assert _parse_uuid("not-a-uuid") is None


def test_parse_uuid_accepts_32_char_hex_without_hyphens() -> None:
    u = uuid.uuid4()
    assert _parse_uuid(u.hex) == u

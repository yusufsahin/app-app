"""Unit tests: deploy webhook HMAC signature verification."""

from __future__ import annotations

import hashlib
import hmac

import pytest

from alm.orgs.api.routes_deploy_webhook import _signature_valid


def _sign(secret: str, body: bytes) -> str:
    mac = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return f"sha256={mac}"


@pytest.mark.parametrize(
    "header",
    [None, "", "sha1=abc", "deadbeef"],
)
def test_signature_invalid_without_sha256_prefix(header: str | None) -> None:
    assert _signature_valid("secret", b"{}", header) is False


def test_signature_rejects_wrong_digest() -> None:
    body = b'{"ping":true}'
    assert _signature_valid("secret", body, "sha256=00" * 32) is False


def test_signature_accepts_valid_header() -> None:
    body = b'{"environment":"p","occurred_at":"2026-01-01T00:00:00Z"}'
    secret = "my-deploy-secret"
    assert _signature_valid(secret, body, _sign(secret, body)) is True


def test_signature_header_matching_is_case_insensitive_for_hex() -> None:
    body = b"payload"
    secret = "s"
    mac = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    upper = f"sha256={mac.upper()}"
    assert _signature_valid(secret, body, upper) is True

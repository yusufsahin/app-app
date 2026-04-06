"""Unit tests: webhook delivery id normalization."""

from __future__ import annotations

from alm.orgs.api.scm_webhook_support import (
    SCM_WEBHOOK_MAX_DELIVERY_ID_LEN,
    normalize_webhook_delivery_id,
)


def test_normalize_accepts_github_like_uuid() -> None:
    s = "01234567-89ab-cdef-0123-456789abcdef"
    assert normalize_webhook_delivery_id(s) == s
    assert normalize_webhook_delivery_id(f"  {s}  ") == s


def test_normalize_rejects_empty_and_too_long() -> None:
    assert normalize_webhook_delivery_id(None) is None
    assert normalize_webhook_delivery_id("") is None
    assert normalize_webhook_delivery_id("   ") is None
    assert normalize_webhook_delivery_id("x" * (SCM_WEBHOOK_MAX_DELIVERY_ID_LEN + 1)) is None


def test_normalize_rejects_control_chars() -> None:
    assert normalize_webhook_delivery_id("ab\nc") is None
    assert normalize_webhook_delivery_id("a\x7fb") is None

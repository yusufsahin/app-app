"""Fulltext regconfig allowlist and manifest search_locale."""

from __future__ import annotations

from alm.artifact.domain.fulltext_config import (
    normalize_fulltext_regconfig,
    resolve_fulltext_regconfig,
)


def test_normalize_unknown_falls_back_to_english() -> None:
    assert normalize_fulltext_regconfig("not-a-real-config") == "english"
    assert normalize_fulltext_regconfig(None) == "english"


def test_normalize_turkish_allowed() -> None:
    assert normalize_fulltext_regconfig("turkish") == "turkish"


def test_resolve_uses_manifest_search_locale() -> None:
    assert resolve_fulltext_regconfig({"search_locale": "turkish"}, "english") == "turkish"


def test_resolve_invalid_manifest_locale_uses_normalize() -> None:
    assert resolve_fulltext_regconfig({"search_locale": "bogus"}, "german") == "english"


def test_resolve_missing_uses_settings_default() -> None:
    assert resolve_fulltext_regconfig({}, "turkish") == "turkish"
    assert resolve_fulltext_regconfig(None, "simple") == "simple"

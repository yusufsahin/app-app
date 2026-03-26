"""PostgreSQL text search regconfig allowlist + manifest ``search_locale`` override."""

from __future__ import annotations

from typing import Any

ALLOWED_FULLTEXT_REGCONFIGS: frozenset[str] = frozenset(
    {
        "english",
        "simple",
        "turkish",
        "german",
        "french",
        "spanish",
        "italian",
        "dutch",
        "russian",
        "japanese",
    }
)


def normalize_fulltext_regconfig(name: str | None) -> str:
    c = (name or "english").strip().lower()
    return c if c in ALLOWED_FULLTEXT_REGCONFIGS else "english"


def resolve_fulltext_regconfig(manifest_bundle: dict[str, Any] | None, settings_default: str) -> str:
    """Use manifest ``search_locale`` when allowlisted; otherwise ``settings_default`` (then normalize)."""
    raw = (manifest_bundle or {}).get("search_locale")
    if isinstance(raw, str) and raw.strip():
        return normalize_fulltext_regconfig(raw.strip())
    return normalize_fulltext_regconfig(settings_default)

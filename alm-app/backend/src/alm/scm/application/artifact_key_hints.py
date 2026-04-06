"""Heuristic extraction of work-item key tokens from PR/commit text (S2)."""

from __future__ import annotations

import re

# Uppercase-leading token (REQ-42, ABC-1) — reduces noise vs arbitrary lowercase words.
_KEY_TOKEN = re.compile(r"\b([A-Z][A-Za-z0-9]{0,24}-\d{1,7})\b")

# Require a path/start/quote boundary before the branch prefix (avoids matching inside "not-a-feature/…").
_BRANCH = re.compile(
    r'(?:^|[/\s"\'])(?:feature|fix|hotfix|feat|chore|bugfix)/([A-Za-z][A-Za-z0-9]{0,24}-\d{1,7})(?:/|-|$)',
    re.IGNORECASE,
)


def _normalize_key(key: str) -> str:
    key = key.strip()
    if "-" not in key:
        return key
    left, right = key.rsplit("-", 1)
    if not right.isdigit():
        return key
    return f"{left.upper()}-{right}"


def extract_artifact_key_hints(text: str, *, limit: int = 8) -> list[str]:
    """Return unique keys in first-seen order (best-effort; not validated against the project)."""
    if not (text or "").strip():
        return []
    seen: set[str] = set()
    out: list[str] = []

    def push(raw: str) -> None:
        norm = _normalize_key(raw)
        if norm in seen:
            return
        seen.add(norm)
        out.append(norm)

    for m in _KEY_TOKEN.finditer(text):
        push(m.group(1))
        if len(out) >= limit:
            return out
    for m in _BRANCH.finditer(text):
        push(m.group(1))
        if len(out) >= limit:
            return out
    return out

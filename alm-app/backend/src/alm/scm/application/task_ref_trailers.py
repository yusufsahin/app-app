"""Parse git-trailer style task references from PR/commit text (webhook metadata)."""

from __future__ import annotations

import re
import uuid

# Git trailers: `Refs:` (common) and `Task-ID:` (e.g. some CI / commit hooks).
_TASK_UUID_TRAILER = re.compile(
    r"^\s*(?:refs|task-id)\s*:\s*(.+)$",
    re.IGNORECASE | re.MULTILINE,
)


def iter_task_uuids_from_refs_trailers(text: str) -> list[uuid.UUID]:
    """Collect UUIDs from `Refs:` or `Task-ID:` lines (comma-separated values allowed), in document order.

    Non-UUID tokens on the same line are skipped. Duplicate UUIDs are kept once (first occurrence).
    """
    if not (text or "").strip():
        return []
    seen: set[uuid.UUID] = set()
    ordered: list[uuid.UUID] = []
    for m in _TASK_UUID_TRAILER.finditer(text):
        raw = m.group(1).strip()
        for piece in re.split(r"\s*,\s*", raw):
            token = piece.strip()
            if not token:
                continue
            try:
                u = uuid.UUID(token)
            except ValueError:
                continue
            if u not in seen:
                seen.add(u)
                ordered.append(u)
    return ordered

"""SCM link DTOs."""

from __future__ import annotations

import uuid
from dataclasses import dataclass


@dataclass(frozen=True)
class ScmLinkDTO:
    id: uuid.UUID
    project_id: uuid.UUID
    artifact_id: uuid.UUID
    task_id: uuid.UUID | None
    provider: str
    repo_full_name: str
    ref: str | None
    commit_sha: str | None
    pull_request_number: int | None
    title: str | None
    web_url: str
    source: str
    key_match_source: str | None
    created_by: uuid.UUID | None
    created_at: str | None
    updated_at: str | None


@dataclass(frozen=True)
class ScmUrlPreviewKeyMatchDTO:
    """Hint resolved to an artifact in the same project (case-insensitive key match)."""

    hint: str
    artifact_id: uuid.UUID
    artifact_key: str
    title: str
    is_current_artifact: bool


@dataclass(frozen=True)
class ScmUrlPreviewDTO:
    """Parsed SCM URL metadata for UI preview (no persistence)."""

    canonical_web_url: str
    recognized: bool
    provider: str | None
    repo_full_name: str | None
    pull_request_number: int | None
    commit_sha: str | None
    suggested_title: str | None
    artifact_key_hints: tuple[str, ...] = ()
    artifact_key_matches: tuple[ScmUrlPreviewKeyMatchDTO, ...] = ()
    artifact_key_unmatched: tuple[str, ...] = ()
    duplicate_link_id: uuid.UUID | None = None
    duplicate_kind: str = "none"  # none | url | pull_request | commit

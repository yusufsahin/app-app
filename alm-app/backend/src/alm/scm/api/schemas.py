"""SCM link API schemas."""

from __future__ import annotations

import uuid
from typing import Any, Literal

from pydantic import BaseModel, Field


class ScmLinkResponse(BaseModel):
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
    created_by: uuid.UUID | None
    created_at: str | None
    updated_at: str | None
    key_match_source: str | None = None

    model_config = {"from_attributes": True}


class ScmLinkParsePreviewRequest(BaseModel):
    web_url: str = Field(..., min_length=1, max_length=8000)
    context_text: str | None = Field(None, max_length=20000)


class ScmLinkParsePreviewKeyMatch(BaseModel):
    hint: str
    artifact_id: uuid.UUID
    artifact_key: str
    title: str
    is_current_artifact: bool


class ScmLinkParsePreviewResponse(BaseModel):
    canonical_web_url: str
    recognized: bool
    provider: str | None = None
    repo_full_name: str | None = None
    pull_request_number: int | None = None
    commit_sha: str | None = None
    suggested_title: str | None = None
    artifact_key_hints: list[str] = Field(default_factory=list)
    artifact_key_matches: list[ScmLinkParsePreviewKeyMatch] = Field(default_factory=list)
    artifact_key_unmatched: list[str] = Field(default_factory=list)
    duplicate_link_id: uuid.UUID | None = None
    duplicate_kind: Literal["none", "url", "pull_request", "commit"] = "none"


class ScmLinkCreateRequest(BaseModel):
    web_url: str = Field(..., min_length=1, max_length=8000)
    task_id: uuid.UUID | None = None
    provider: str | None = Field(None, max_length=32)
    repo_full_name: str | None = Field(None, max_length=512)
    ref: str | None = Field(None, max_length=255)
    commit_sha: str | None = Field(None, max_length=64)
    pull_request_number: int | None = Field(None, ge=1)
    title: str | None = Field(None, max_length=500)
    source: Literal["manual", "ci"] | None = Field(
        None,
        description="Defaults to manual. Use `ci` when a pipeline calls this API (metrics / audit).",
    )


class ScmWebhookUnmatchedEventResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    provider: str
    kind: str
    context: dict[str, Any]
    created_at: str
    dismissed_at: str | None = None
    dismissed_by: uuid.UUID | None = None

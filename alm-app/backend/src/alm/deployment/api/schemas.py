"""Deployment event API schemas."""

from __future__ import annotations

import uuid
from typing import Any, Literal

from pydantic import BaseModel, Field


class DeploymentEventResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    environment: str
    occurred_at: str
    commit_sha: str | None
    image_digest: str | None
    repo_full_name: str | None
    artifact_keys: list[str] | None
    release_label: str | None
    build_id: str | None
    source: str
    raw_context: dict[str, Any] | None
    idempotency_key: str | None
    created_at: str


class DeploymentEventCreateRequest(BaseModel):
    environment: str = Field(..., min_length=1, max_length=64)
    occurred_at: str = Field(..., min_length=1, max_length=80)
    commit_sha: str | None = Field(None, max_length=64)
    image_digest: str | None = Field(None, max_length=512)
    repo_full_name: str | None = Field(None, max_length=512)
    artifact_keys: list[str] | None = Field(None, max_length=64)
    release_label: str | None = Field(None, max_length=256)
    build_id: str | None = Field(None, max_length=256)
    source: Literal["api", "manual", "ci_webhook"] = "api"
    raw_context: dict[str, Any] | None = None
    idempotency_key: str | None = Field(None, max_length=128)


class TraceabilityScmLinkSummaryItem(BaseModel):
    web_url: str
    commit_sha: str | None
    provider: str
    title: str | None


class TraceabilityEnvironmentItem(BaseModel):
    environment: str
    last_occurred_at: str
    commit_sha: str | None
    image_digest: str | None
    release_label: str | None
    build_id: str | None
    source: str
    matched_via: Literal["artifact_key", "commit_sha"]
    deployment_event_id: uuid.UUID


class ArtifactTraceabilitySummaryResponse(BaseModel):
    artifact_id: uuid.UUID
    artifact_key: str | None
    environments: list[TraceabilityEnvironmentItem]
    scm_links: list[TraceabilityScmLinkSummaryItem]

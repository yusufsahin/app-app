"""DTOs for artifact traceability summary (deploy + SCM)."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class ScmLinkSummaryItemDTO:
    web_url: str
    commit_sha: str | None
    provider: str
    title: str | None
    key_match_source: str | None = None


@dataclass(frozen=True)
class EnvironmentDeploySummaryDTO:
    environment: str
    last_occurred_at: str
    commit_sha: str | None
    image_digest: str | None
    release_label: str | None
    build_id: str | None
    source: str
    matched_via: Literal["artifact_key", "commit_sha"]
    deployment_event_id: uuid.UUID


@dataclass(frozen=True)
class ArtifactTraceabilitySummaryDTO:
    artifact_id: uuid.UUID
    artifact_key: str | None
    environments: list[EnvironmentDeploySummaryDTO]
    scm_links: list[ScmLinkSummaryItemDTO]

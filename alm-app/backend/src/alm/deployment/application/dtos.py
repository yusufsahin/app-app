"""Deployment event DTOs."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any

from alm.deployment.infrastructure.models import DeploymentEventModel


@dataclass(frozen=True)
class DeploymentEventDTO:
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


def deployment_event_dto_from_model(m: DeploymentEventModel) -> DeploymentEventDTO:
    return DeploymentEventDTO(
        id=m.id,
        project_id=m.project_id,
        environment=m.environment,
        occurred_at=m.occurred_at.isoformat(),
        commit_sha=m.commit_sha,
        image_digest=m.image_digest,
        repo_full_name=m.repo_full_name,
        artifact_keys=list(m.artifact_keys) if m.artifact_keys is not None else None,
        release_label=m.release_label,
        build_id=m.build_id,
        source=m.source,
        raw_context=dict(m.raw_context) if isinstance(m.raw_context, dict) else m.raw_context,
        idempotency_key=m.idempotency_key,
        created_at=m.created_at.isoformat(),
    )

"""Record a deployment event (S4a)."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from alm.deployment.application.dtos import DeploymentEventDTO, deployment_event_dto_from_model
from alm.deployment.infrastructure.models import DeploymentEventModel
from alm.project.domain.ports import ProjectRepository
from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ValidationError


@dataclass(frozen=True)
class CreateDeploymentEvent(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    environment: str
    occurred_at: str  # ISO8601
    commit_sha: str | None = None
    image_digest: str | None = None
    repo_full_name: str | None = None
    artifact_keys: list[str] | None = None
    release_label: str | None = None
    build_id: str | None = None
    source: str = "api"
    raw_context: dict[str, Any] | None = None
    idempotency_key: str | None = None


class CreateDeploymentEventHandler(CommandHandler[DeploymentEventDTO]):
    def __init__(self, session: AsyncSession, project_repo: ProjectRepository) -> None:
        self._session = session
        self._project_repo = project_repo

    async def handle(self, command: Command) -> DeploymentEventDTO:
        assert isinstance(command, CreateDeploymentEvent)

        project = await self._project_repo.find_by_id(command.project_id)
        if project is None or project.tenant_id != command.tenant_id:
            raise ValidationError("Project not found")

        env = (command.environment or "").strip()
        if not env or len(env) > 64:
            raise ValidationError("environment is required (max 64 chars)")

        src = (command.source or "api").strip().lower()
        if src not in ("api", "manual", "ci_webhook"):
            raise ValidationError("source must be api, manual, or ci_webhook")

        try:
            occurred = datetime.fromisoformat(command.occurred_at.replace("Z", "+00:00"))
        except ValueError as e:
            raise ValidationError("occurred_at must be ISO8601") from e

        sha = (command.commit_sha or "").strip() or None
        if sha:
            sha = sha.lower()[:64]

        idem = (command.idempotency_key or "").strip() or None
        if idem and len(idem) > 128:
            raise ValidationError("idempotency_key too long")

        build_id = (command.build_id or "").strip() or None
        if build_id and len(build_id) > 256:
            raise ValidationError("build_id too long")

        if idem:
            r = await self._session.execute(
                select(DeploymentEventModel).where(
                    DeploymentEventModel.project_id == command.project_id,
                    DeploymentEventModel.idempotency_key == idem,
                )
            )
            existing = r.scalar_one_or_none()
            if existing is not None:
                return deployment_event_dto_from_model(existing)

        if build_id:
            r = await self._session.execute(
                select(DeploymentEventModel).where(
                    DeploymentEventModel.project_id == command.project_id,
                    DeploymentEventModel.environment == env,
                    DeploymentEventModel.build_id == build_id,
                )
            )
            existing = r.scalar_one_or_none()
            if existing is not None:
                return deployment_event_dto_from_model(existing)

        keys = command.artifact_keys
        if keys is not None:
            keys = [k.strip() for k in keys if (k or "").strip()][:64]
            if not keys:
                keys = None

        row = DeploymentEventModel(
            id=uuid.uuid4(),
            project_id=command.project_id,
            environment=env,
            occurred_at=occurred,
            commit_sha=sha,
            image_digest=(command.image_digest or "").strip()[:512] or None,
            repo_full_name=(command.repo_full_name or "").strip()[:512] or None,
            artifact_keys=keys,
            release_label=(command.release_label or "").strip()[:256] or None,
            build_id=build_id,
            source=src,
            raw_context=command.raw_context,
            idempotency_key=idem,
        )
        self._session.add(row)
        await self._session.flush()

        return deployment_event_dto_from_model(row)

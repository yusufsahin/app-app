"""List deployment events for a project."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from alm.deployment.application.dtos import DeploymentEventDTO, deployment_event_dto_from_model
from alm.deployment.infrastructure.models import DeploymentEventModel
from alm.project.domain.ports import ProjectRepository
from alm.shared.application.query import Query, QueryHandler
from alm.shared.domain.exceptions import ValidationError


@dataclass(frozen=True)
class ListDeploymentEvents(Query):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    environment: str | None = None
    artifact_key: str | None = None
    limit: int = 100


class ListDeploymentEventsHandler(QueryHandler[list[DeploymentEventDTO]]):
    def __init__(self, session: AsyncSession, project_repo: ProjectRepository) -> None:
        self._session = session
        self._project_repo = project_repo

    async def handle(self, query: Query) -> list[DeploymentEventDTO]:
        assert isinstance(query, ListDeploymentEvents)

        project = await self._project_repo.find_by_id(query.project_id)
        if project is None or project.tenant_id != query.tenant_id:
            raise ValidationError("Project not found")

        lim = min(max(query.limit, 1), 500)

        q = select(DeploymentEventModel).where(DeploymentEventModel.project_id == query.project_id)
        if query.environment and query.environment.strip():
            q = q.where(DeploymentEventModel.environment == query.environment.strip())
        if query.artifact_key and query.artifact_key.strip():
            ak = query.artifact_key.strip()
            q = q.where(DeploymentEventModel.artifact_keys.contains([ak]))
        q = q.order_by(DeploymentEventModel.occurred_at.desc()).limit(lim)

        r = await self._session.execute(q)
        rows = r.scalars().all()
        return [deployment_event_dto_from_model(m) for m in rows]

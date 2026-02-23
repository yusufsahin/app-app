from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.query import Query, QueryHandler
from alm.project.application.dtos import ProjectDTO
from alm.project.domain.ports import ProjectRepository


@dataclass(frozen=True)
class GetProject(Query):
    tenant_id: uuid.UUID
    project_id: uuid.UUID


class GetProjectHandler(QueryHandler[ProjectDTO | None]):
    def __init__(self, project_repo: ProjectRepository) -> None:
        self._project_repo = project_repo

    async def handle(self, query: Query) -> ProjectDTO | None:
        assert isinstance(query, GetProject)

        project = await self._project_repo.find_by_id(query.project_id)
        if project is None or project.tenant_id != query.tenant_id:
            return None

        return ProjectDTO(
            id=project.id,
            code=project.code,
            name=project.name,
            slug=project.slug,
            description=project.description,
        )

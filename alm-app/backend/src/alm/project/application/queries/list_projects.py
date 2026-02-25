from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.project.application.dtos import ProjectDTO
from alm.project.domain.ports import ProjectRepository
from alm.shared.application.query import Query, QueryHandler


@dataclass(frozen=True)
class ListProjects(Query):
    tenant_id: uuid.UUID


class ListProjectsHandler(QueryHandler[list[ProjectDTO]]):
    def __init__(self, project_repo: ProjectRepository) -> None:
        self._project_repo = project_repo

    async def handle(self, query: Query) -> list[ProjectDTO]:
        assert isinstance(query, ListProjects)

        projects = await self._project_repo.list_by_tenant(query.tenant_id)
        return [
            ProjectDTO(
                id=p.id,
                code=p.code,
                name=p.name,
                slug=p.slug,
                description=p.description,
                status=p.status,
                settings=p.settings,
                metadata_=p.metadata_,
            )
            for p in projects
        ]

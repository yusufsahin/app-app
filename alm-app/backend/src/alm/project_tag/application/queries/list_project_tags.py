"""List all tags defined for a project."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.project.domain.ports import ProjectRepository
from alm.project_tag.application.dtos import ProjectTagDTO
from alm.project_tag.domain.ports import ProjectTagRepository
from alm.shared.application.query import Query, QueryHandler
from alm.shared.domain.exceptions import ValidationError


@dataclass(frozen=True)
class ListProjectTags(Query):
    tenant_id: uuid.UUID
    project_id: uuid.UUID


class ListProjectTagsHandler(QueryHandler[list[ProjectTagDTO]]):
    def __init__(
        self,
        project_repo: ProjectRepository,
        tag_repo: ProjectTagRepository,
    ) -> None:
        self._project_repo = project_repo
        self._tag_repo = tag_repo

    async def handle(self, query: Query) -> list[ProjectTagDTO]:
        assert isinstance(query, ListProjectTags)
        project = await self._project_repo.find_by_id(query.project_id)
        if project is None or project.tenant_id != query.tenant_id:
            raise ValidationError("Project not found")
        return await self._tag_repo.list_by_project(query.project_id)

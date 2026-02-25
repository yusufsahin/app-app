"""List project members query."""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.query import Query, QueryHandler
from alm.project.domain.project_member import ProjectMember
from alm.project.domain.ports import ProjectMemberRepository, ProjectRepository


@dataclass(frozen=True)
class ListProjectMembers(Query):
    tenant_id: uuid.UUID
    project_id: uuid.UUID


class ListProjectMembersHandler(QueryHandler[list[ProjectMember]]):
    def __init__(
        self,
        project_repo: ProjectRepository,
        project_member_repo: ProjectMemberRepository,
    ) -> None:
        self._project_repo = project_repo
        self._project_member_repo = project_member_repo

    async def handle(self, query: Query) -> list[ProjectMember]:
        assert isinstance(query, ListProjectMembers)

        project = await self._project_repo.find_by_id(query.project_id)
        if project is None or project.tenant_id != query.tenant_id:
            return []

        return await self._project_member_repo.list_by_project(query.project_id)

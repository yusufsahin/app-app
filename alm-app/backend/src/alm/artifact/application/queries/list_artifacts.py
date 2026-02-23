"""List artifacts for a project."""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.query import Query, QueryHandler
from alm.artifact.application.dtos import ArtifactDTO
from alm.artifact.domain.ports import ArtifactRepository
from alm.project.domain.ports import ProjectRepository


@dataclass(frozen=True)
class ListArtifacts(Query):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    state_filter: str | None = None


class ListArtifactsHandler(QueryHandler[list[ArtifactDTO]]):
    def __init__(
        self,
        artifact_repo: ArtifactRepository,
        project_repo: ProjectRepository,
    ) -> None:
        self._artifact_repo = artifact_repo
        self._project_repo = project_repo

    async def handle(self, query: Query) -> list[ArtifactDTO]:
        assert isinstance(query, ListArtifacts)

        project = await self._project_repo.find_by_id(query.project_id)
        if project is None or project.tenant_id != query.tenant_id:
            return []

        artifacts = await self._artifact_repo.list_by_project(
            query.project_id, query.state_filter
        )
        return [
            ArtifactDTO(
                id=a.id,
                project_id=a.project_id,
                artifact_type=a.artifact_type,
                title=a.title,
                description=a.description,
                state=a.state,
                assignee_id=a.assignee_id,
                parent_id=a.parent_id,
                custom_fields=a.custom_fields,
            )
            for a in artifacts
        ]

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
    type_filter: str | None = None
    search_query: str | None = None
    cycle_node_id: uuid.UUID | None = None
    area_node_id: uuid.UUID | None = None
    sort_by: str | None = None
    sort_order: str | None = None
    limit: int | None = None
    offset: int | None = None
    include_deleted: bool = False


@dataclass
class ListArtifactsResult:
    items: list[ArtifactDTO]
    total: int


class ListArtifactsHandler(QueryHandler[ListArtifactsResult]):
    def __init__(
        self,
        artifact_repo: ArtifactRepository,
        project_repo: ProjectRepository,
    ) -> None:
        self._artifact_repo = artifact_repo
        self._project_repo = project_repo

    async def handle(self, query: Query) -> ListArtifactsResult:
        assert isinstance(query, ListArtifacts)

        project = await self._project_repo.find_by_id(query.project_id)
        if project is None or project.tenant_id != query.tenant_id:
            return ListArtifactsResult(items=[], total=0)

        total = await self._artifact_repo.count_by_project(
            query.project_id,
            query.state_filter,
            type_filter=query.type_filter,
            search_query=query.search_query,
            cycle_node_id=query.cycle_node_id,
            area_node_id=query.area_node_id,
            include_deleted=query.include_deleted,
        )
        artifacts = await self._artifact_repo.list_by_project(
            query.project_id,
            query.state_filter,
            type_filter=query.type_filter,
            search_query=query.search_query,
            cycle_node_id=query.cycle_node_id,
            area_node_id=query.area_node_id,
            sort_by=query.sort_by,
            sort_order=query.sort_order,
            limit=query.limit,
            offset=query.offset,
            include_deleted=query.include_deleted,
        )
        items = [
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
                artifact_key=a.artifact_key,
                state_reason=a.state_reason,
                resolution=a.resolution,
                rank_order=a.rank_order,
                cycle_node_id=getattr(a, "cycle_node_id", None),
                area_node_id=getattr(a, "area_node_id", None),
                area_path_snapshot=getattr(a, "area_path_snapshot", None),
                created_at=getattr(a, "created_at", None),
                updated_at=getattr(a, "updated_at", None),
            )
            for a in artifacts
        ]
        return ListArtifactsResult(items=items, total=total)

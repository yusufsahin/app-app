"""List artifacts for a project."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.artifact.application.dtos import ArtifactDTO
from alm.artifact.domain.ports import ArtifactRepository
from alm.cycle.domain.ports import CycleRepository
from alm.project.domain.ports import ProjectRepository
from alm.shared.application.query import Query, QueryHandler


TREE_ROOT_TYPE: dict[str, str] = {
    "requirement": "root-requirement",
    "quality": "root-quality",
    "defect": "root-defect",
}


@dataclass(frozen=True)
class ListArtifacts(Query):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    state_filter: str | None = None
    type_filter: str | None = None
    search_query: str | None = None
    cycle_node_id: uuid.UUID | None = None
    release_cycle_node_id: uuid.UUID | None = None  # when set, filter by all iteration ids under this release
    area_node_id: uuid.UUID | None = None
    sort_by: str | None = None
    sort_order: str | None = None
    limit: int | None = None
    offset: int | None = None
    include_deleted: bool = False
    tree: str | None = None  # "requirement" | "quality" | "defect" -> filter to that root's subtree


@dataclass
class ListArtifactsResult:
    items: list[ArtifactDTO]
    total: int


class ListArtifactsHandler(QueryHandler[ListArtifactsResult]):
    def __init__(
        self,
        artifact_repo: ArtifactRepository,
        project_repo: ProjectRepository,
        cycle_repo: CycleRepository,
    ) -> None:
        self._artifact_repo = artifact_repo
        self._project_repo = project_repo
        self._cycle_repo = cycle_repo

    async def handle(self, query: Query) -> ListArtifactsResult:
        assert isinstance(query, ListArtifacts)

        project = await self._project_repo.find_by_id(query.project_id)
        if project is None or project.tenant_id != query.tenant_id:
            return ListArtifactsResult(items=[], total=0)

        cycle_node_ids: list[uuid.UUID] | None = None
        cycle_node_id_single: uuid.UUID | None = query.cycle_node_id
        if query.release_cycle_node_id:
            release_node = await self._cycle_repo.find_by_id(query.release_cycle_node_id)
            if release_node and release_node.project_id == query.project_id:
                all_cycles = await self._cycle_repo.list_by_project(query.project_id)
                release_path = getattr(release_node, "path", "") or ""
                # Descendants: path starts with release.path + "/" (iterations under release)
                cycle_node_ids = [
                    c.id for c in all_cycles
                    if c.path != release_path and c.path.startswith(release_path + "/")
                ]
                if not cycle_node_ids:
                    return ListArtifactsResult(items=[], total=0)
                cycle_node_id_single = None
        elif query.cycle_node_id:
            cycle_node_id_single = query.cycle_node_id

        root_artifact_id: uuid.UUID | None = None
        if query.tree and query.tree.strip():
            root_type = TREE_ROOT_TYPE.get(query.tree.strip().lower())
            if root_type:
                roots = await self._artifact_repo.list_by_project(
                    query.project_id,
                    type_filter=root_type,
                    limit=1,
                    include_deleted=query.include_deleted,
                )
                if roots:
                    root_artifact_id = roots[0].id

        total = await self._artifact_repo.count_by_project(
            query.project_id,
            query.state_filter,
            type_filter=query.type_filter,
            search_query=query.search_query,
            cycle_node_id=cycle_node_id_single,
            cycle_node_ids=cycle_node_ids,
            area_node_id=query.area_node_id,
            include_deleted=query.include_deleted,
            root_artifact_id=root_artifact_id,
            exclude_root_artifact_types=True,
        )
        artifacts = await self._artifact_repo.list_by_project(
            query.project_id,
            query.state_filter,
            type_filter=query.type_filter,
            search_query=query.search_query,
            cycle_node_id=cycle_node_id_single,
            cycle_node_ids=cycle_node_ids,
            area_node_id=query.area_node_id,
            sort_by=query.sort_by,
            sort_order=query.sort_order,
            limit=query.limit,
            offset=query.offset,
            include_deleted=query.include_deleted,
            root_artifact_id=root_artifact_id,
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

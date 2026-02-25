"""Get area node by id."""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.query import Query, QueryHandler
from alm.area.application.dtos import AreaNodeDTO
from alm.area.domain.ports import AreaRepository
from alm.project.domain.ports import ProjectRepository


@dataclass(frozen=True)
class GetAreaNode(Query):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    area_node_id: uuid.UUID


class GetAreaNodeHandler(QueryHandler[AreaNodeDTO | None]):
    def __init__(
        self,
        area_repo: AreaRepository,
        project_repo: ProjectRepository,
    ) -> None:
        self._area_repo = area_repo
        self._project_repo = project_repo

    async def handle(self, query: Query) -> AreaNodeDTO | None:
        assert isinstance(query, GetAreaNode)

        project = await self._project_repo.find_by_id(query.project_id)
        if project is None or project.tenant_id != query.tenant_id:
            return None

        node = await self._area_repo.find_by_id(query.area_node_id)
        if node is None or node.project_id != query.project_id:
            return None

        return AreaNodeDTO(
            id=node.id,
            project_id=node.project_id,
            name=node.name,
            path=node.path,
            parent_id=node.parent_id,
            depth=node.depth,
            sort_order=node.sort_order,
            is_active=node.is_active,
            created_at=node.created_at.isoformat() if node.created_at else None,
            updated_at=node.updated_at.isoformat() if node.updated_at else None,
        )

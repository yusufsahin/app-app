"""Get cycle node by id."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.cycle.application.dtos import CycleNodeDTO
from alm.cycle.domain.ports import CycleRepository
from alm.project.domain.ports import ProjectRepository
from alm.shared.application.query import Query, QueryHandler


@dataclass(frozen=True)
class GetCycleNode(Query):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    cycle_node_id: uuid.UUID


class GetCycleNodeHandler(QueryHandler[CycleNodeDTO | None]):
    def __init__(
        self,
        cycle_repo: CycleRepository,
        project_repo: ProjectRepository,
    ) -> None:
        self._cycle_repo = cycle_repo
        self._project_repo = project_repo

    async def handle(self, query: Query) -> CycleNodeDTO | None:
        assert isinstance(query, GetCycleNode)

        project = await self._project_repo.find_by_id(query.project_id)
        if project is None or project.tenant_id != query.tenant_id:
            return None

        node = await self._cycle_repo.find_by_id(query.cycle_node_id)
        if node is None or node.project_id != query.project_id:
            return None

        return CycleNodeDTO(
            id=node.id,
            project_id=node.project_id,
            name=node.name,
            path=node.path,
            parent_id=node.parent_id,
            depth=node.depth,
            sort_order=node.sort_order,
            goal=node.goal,
            start_date=node.start_date,
            end_date=node.end_date,
            state=node.state,
            kind=getattr(node, "kind", "iteration") or "iteration",
            created_at=node.created_at.isoformat() if node.created_at else None,
            updated_at=node.updated_at.isoformat() if node.updated_at else None,
        )

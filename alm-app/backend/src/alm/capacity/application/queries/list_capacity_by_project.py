"""List capacity entries by project with optional filters."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.capacity.application.dtos import CapacityDTO
from alm.capacity.domain.ports import CapacityRepository
from alm.project.domain.ports import ProjectRepository
from alm.shared.application.query import Query, QueryHandler


@dataclass(frozen=True)
class ListCapacityByProject(Query):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    cycle_node_id: uuid.UUID | None = None
    team_id: uuid.UUID | None = None
    user_id: uuid.UUID | None = None


class ListCapacityByProjectHandler(QueryHandler[list[CapacityDTO]]):
    def __init__(self, capacity_repo: CapacityRepository, project_repo: ProjectRepository) -> None:
        self._capacity_repo = capacity_repo
        self._project_repo = project_repo

    async def handle(self, query: Query) -> list[CapacityDTO]:
        assert isinstance(query, ListCapacityByProject)
        project = await self._project_repo.find_by_id(query.project_id)
        if project is None or project.tenant_id != query.tenant_id:
            return []
        rows = await self._capacity_repo.list_by_project(
            query.project_id,
            cycle_node_id=query.cycle_node_id,
            team_id=query.team_id,
            user_id=query.user_id,
        )
        return [
            CapacityDTO(
                id=r.id,
                project_id=r.project_id,
                cycle_node_id=r.cycle_node_id,
                team_id=r.team_id,
                user_id=r.user_id,
                capacity_value=r.capacity_value,
                unit=r.unit,
                created_at=r.created_at.isoformat() if r.created_at else None,
                updated_at=r.updated_at.isoformat() if r.updated_at else None,
            )
            for r in rows
        ]


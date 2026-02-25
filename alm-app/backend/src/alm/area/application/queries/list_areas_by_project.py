"""List area nodes for a project (flat or tree)."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.area.application.dtos import AreaNodeDTO
from alm.area.domain.ports import AreaRepository
from alm.project.domain.ports import ProjectRepository
from alm.shared.application.query import Query, QueryHandler


def _build_tree(flat: list[AreaNodeDTO], parent_id: uuid.UUID | None) -> list[AreaNodeDTO]:
    out: list[AreaNodeDTO] = []
    for d in flat:
        if d.parent_id != parent_id:
            continue
        child_dto = AreaNodeDTO(
            id=d.id,
            project_id=d.project_id,
            name=d.name,
            path=d.path,
            parent_id=d.parent_id,
            depth=d.depth,
            sort_order=d.sort_order,
            is_active=d.is_active,
            created_at=d.created_at,
            updated_at=d.updated_at,
            children=_build_tree(flat, d.id),
        )
        out.append(child_dto)
    return sorted(out, key=lambda x: (x.sort_order, x.path))


@dataclass(frozen=True)
class ListAreaNodesByProject(Query):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    flat: bool = True


class ListAreaNodesByProjectHandler(QueryHandler[list[AreaNodeDTO]]):
    def __init__(
        self,
        area_repo: AreaRepository,
        project_repo: ProjectRepository,
    ) -> None:
        self._area_repo = area_repo
        self._project_repo = project_repo

    async def handle(self, query: Query) -> list[AreaNodeDTO]:
        assert isinstance(query, ListAreaNodesByProject)

        project = await self._project_repo.find_by_id(query.project_id)
        if project is None or project.tenant_id != query.tenant_id:
            return []

        nodes = await self._area_repo.list_by_project(query.project_id)
        flat_dtos = [
            AreaNodeDTO(
                id=n.id,
                project_id=n.project_id,
                name=n.name,
                path=n.path,
                parent_id=n.parent_id,
                depth=n.depth,
                sort_order=n.sort_order,
                is_active=n.is_active,
                created_at=n.created_at.isoformat() if n.created_at else None,
                updated_at=n.updated_at.isoformat() if n.updated_at else None,
            )
            for n in nodes
        ]

        if query.flat:
            return flat_dtos
        return _build_tree(flat_dtos, None)

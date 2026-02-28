"""List cycle nodes for a project (flat or tree)."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.cycle.application.dtos import CycleNodeDTO
from alm.cycle.domain.ports import CycleRepository
from alm.project.domain.ports import ProjectRepository
from alm.shared.application.query import Query, QueryHandler


def _build_tree(flat: list[CycleNodeDTO], parent_id: uuid.UUID | None) -> list[CycleNodeDTO]:
    out: list[CycleNodeDTO] = []
    for d in flat:
        if d.parent_id != parent_id:
            continue
        child_dto = CycleNodeDTO(
            id=d.id,
            project_id=d.project_id,
            name=d.name,
            path=d.path,
            parent_id=d.parent_id,
            depth=d.depth,
            sort_order=d.sort_order,
            goal=d.goal,
            start_date=d.start_date,
            end_date=d.end_date,
            state=d.state,
            kind=d.kind,
            created_at=d.created_at,
            updated_at=d.updated_at,
            children=_build_tree(flat, d.id),
        )
        out.append(child_dto)
    return sorted(out, key=lambda x: (x.sort_order, x.path))


@dataclass(frozen=True)
class ListCycleNodesByProject(Query):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    flat: bool = True
    kind: str | None = None  # "release" | "iteration" to filter


class ListCycleNodesByProjectHandler(QueryHandler[list[CycleNodeDTO]]):
    def __init__(
        self,
        cycle_repo: CycleRepository,
        project_repo: ProjectRepository,
    ) -> None:
        self._cycle_repo = cycle_repo
        self._project_repo = project_repo

    async def handle(self, query: Query) -> list[CycleNodeDTO]:
        assert isinstance(query, ListCycleNodesByProject)

        project = await self._project_repo.find_by_id(query.project_id)
        if project is None or project.tenant_id != query.tenant_id:
            return []

        nodes = await self._cycle_repo.list_by_project(query.project_id)
        if query.kind and query.kind.strip().lower() in ("release", "iteration"):
            kind_filter = query.kind.strip().lower()
            nodes = [n for n in nodes if getattr(n, "kind", "iteration") or "iteration" == kind_filter]
        flat_dtos = [
            CycleNodeDTO(
                id=n.id,
                project_id=n.project_id,
                name=n.name,
                path=n.path,
                parent_id=n.parent_id,
                depth=n.depth,
                sort_order=n.sort_order,
                goal=n.goal,
                start_date=n.start_date,
                end_date=n.end_date,
                state=n.state,
                kind=getattr(n, "kind", "iteration") or "iteration",
                created_at=n.created_at.isoformat() if n.created_at else None,
                updated_at=n.updated_at.isoformat() if n.updated_at else None,
            )
            for n in nodes
        ]

        if query.flat:
            return flat_dtos
        return _build_tree(flat_dtos, None)

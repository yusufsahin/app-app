"""Get velocity (sum of done effort per cycle) for a project (P4)."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.artifact.domain.ports import ArtifactRepository
from alm.cycle.domain.ports import CycleRepository
from alm.project.domain.ports import ProjectRepository
from alm.shared.application.query import Query, QueryHandler

# Done states for velocity (terminal workflow states)
DEFAULT_DONE_STATES = ("done", "closed", "resolved")
DEFAULT_EFFORT_FIELD = "story_points"


@dataclass(frozen=True)
class GetVelocity(Query):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    cycle_node_ids: list[uuid.UUID] | None = None  # specific cycles
    last_n: int | None = None  # or last N cycles by path order
    effort_field: str = DEFAULT_EFFORT_FIELD
    done_states: tuple[str, ...] = DEFAULT_DONE_STATES


@dataclass
class VelocityPointDTO:
    cycle_node_id: uuid.UUID
    cycle_name: str
    total_effort: float


class GetVelocityHandler(QueryHandler[list[VelocityPointDTO]]):
    def __init__(
        self,
        project_repo: ProjectRepository,
        cycle_repo: CycleRepository,
        artifact_repo: ArtifactRepository,
    ) -> None:
        self._project_repo = project_repo
        self._cycle_repo = cycle_repo
        self._artifact_repo = artifact_repo

    async def handle(self, query: Query) -> list[VelocityPointDTO]:
        assert isinstance(query, GetVelocity)

        project = await self._project_repo.find_by_id(query.project_id)
        if project is None or project.tenant_id != query.tenant_id:
            return []

        cycle_ids = query.cycle_node_ids
        if cycle_ids is None:
            cycles = await self._cycle_repo.list_by_project(query.project_id)
            if not cycles:
                return []
            if query.last_n is not None and query.last_n > 0:
                cycles = cycles[-query.last_n :]
            cycle_ids = [c.id for c in cycles]

        if not cycle_ids:
            return []

        sums = await self._artifact_repo.sum_effort_by_cycles(
            query.project_id,
            cycle_ids,
            query.done_states,
            query.effort_field,
        )
        sum_by_id = dict(sums)
        cycles = await self._cycle_repo.list_by_project(query.project_id)
        name_by_id = {c.id: c.name for c in cycles}

        return [
            VelocityPointDTO(
                cycle_node_id=cid,
                cycle_name=name_by_id.get(cid, ""),
                total_effort=sum_by_id.get(cid, 0.0),
            )
            for cid in cycle_ids
        ]

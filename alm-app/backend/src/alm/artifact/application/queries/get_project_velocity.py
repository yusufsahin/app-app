"""Get project velocity (done effort per cycle)."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.artifact.domain.ports import ArtifactRepository
from alm.cycle.domain.ports import CycleRepository
from alm.shared.application.query import Query, QueryHandler


@dataclass(frozen=True)
class GetProjectVelocity(Query):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    last_n_cycles: int = 5
    effort_field: str = "story_points"


@dataclass(frozen=True)
class VelocityCyclePoint:
    cycle_id: uuid.UUID
    cycle_name: str
    completed_effort: float


class GetProjectVelocityHandler(QueryHandler[list[VelocityCyclePoint]]):
    def __init__(
        self,
        artifact_repo: ArtifactRepository,
        cycle_repo: CycleRepository,
    ) -> None:
        self._artifact_repo = artifact_repo
        self._cycle_repo = cycle_repo

    async def handle(self, query: Query) -> list[VelocityCyclePoint]:
        assert isinstance(query, GetProjectVelocity)

        # 1. Get cycles for the project, sorted by date (desc)
        all_cycles = await self._cycle_repo.list_by_project(query.project_id)
        # Sort by end_date desc to get "last n"
        sorted_cycles = sorted(
            [c for c in all_cycles if c.end_date],
            key=lambda c: c.end_date,
            reverse=True,
        )
        target_cycles = sorted_cycles[: query.last_n_cycles]
        # Re-sort asc for chart order
        target_cycles.sort(key=lambda c: c.end_date or "")

        if not target_cycles:
            return []

        cycle_ids = [c.id for c in target_cycles]
        # 2. Sum effort for "done" states (convention: closed, done, resolved)
        done_states = ("closed", "done", "resolved")
        sums = await self._artifact_repo.sum_effort_by_cycles(
            query.project_id,
            cycle_ids,
            done_states,
            query.effort_field,
        )

        sum_map = dict(sums)
        return [
            VelocityCyclePoint(
                cycle_id=c.id,
                cycle_name=c.name,
                completed_effort=sum_map.get(c.id, 0.0),
            )
            for c in target_cycles
        ]

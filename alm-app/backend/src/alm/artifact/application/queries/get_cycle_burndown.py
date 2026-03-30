"""Get cycle burndown (remaining effort vs time)."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date, timedelta

from alm.artifact.domain.ports import ArtifactRepository
from alm.cycle.domain.ports import CycleRepository
from alm.shared.application.query import Query, QueryHandler


@dataclass(frozen=True)
class GetCycleBurndown(Query):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    cycle_id: uuid.UUID
    effort_field: str = "story_points"


@dataclass(frozen=True)
class BurndownPoint:
    date: str
    remaining_effort: float
    ideal_effort: float


class GetCycleBurndownHandler(QueryHandler[list[BurndownPoint]]):
    def __init__(
        self,
        artifact_repo: ArtifactRepository,
        cycle_repo: CycleRepository,
    ) -> None:
        self._artifact_repo = artifact_repo
        self._cycle_repo = cycle_repo

    async def handle(self, query: Query) -> list[BurndownPoint]:
        assert isinstance(query, GetCycleBurndown)

        cycle = await self._cycle_repo.find_by_id(query.cycle_id)
        if not cycle or cycle.project_id != query.project_id:
            return []

        start_dt = cycle.start_date
        end_dt = cycle.end_date
        if not start_dt or not end_dt:
            return []

        # 1. Total effort in cycle
        totals = await self._artifact_repo.sum_total_effort_by_cycles(
            query.project_id,
            [cycle.id],
            query.effort_field,
        )
        total_effort = totals[0][1] if totals else 0.0

        # 2. Completed effort per date (convention: daily burndown)
        # MVP: use daily snapshots or calculate from current state (simpler MVP)
        # Real burndown needs daily historical data. For now, we will return 
        # a simple start-to-end ideal line + current remaining as latest point.
        
        # To calculate remaining effort: total - done effort
        done_states = ("closed", "done", "resolved")
        done_sums = await self._artifact_repo.sum_effort_by_cycles(
            query.project_id,
            [cycle.id],
            done_states,
            query.effort_field,
        )
        completed_effort = done_sums[0][1] if done_sums else 0.0
        remaining_now = max(0.0, total_effort - completed_effort)

        points: list[BurndownPoint] = []
        days = (end_dt - start_dt).days + 1
        today = date.today()

        for i in range(days):
            current_date = start_dt + timedelta(days=i)
            # Ideal: linear from total_effort down to 0
            ideal = total_effort * (1 - i / (days - 1)) if days > 1 else total_effort
            
            # Remaining: current remaining if today or before, otherwise None (placeholder)
            rem = remaining_now if current_date <= today else None
            
            points.append(
                BurndownPoint(
                    date=current_date.isoformat(),
                    remaining_effort=rem if rem is not None else 0.0,
                    ideal_effort=round(ideal, 2),
                )
            )

        return points

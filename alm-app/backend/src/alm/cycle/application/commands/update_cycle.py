"""Update cycle node."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date

from alm.cycle.application.dtos import CycleNodeDTO
from alm.cycle.domain.entities import CycleNode
from alm.cycle.domain.ports import CycleRepository
from alm.project.domain.ports import ProjectRepository
from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ValidationError


@dataclass(frozen=True)
class UpdateCycleNode(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    cycle_node_id: uuid.UUID
    name: str | None = None
    goal: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    state: str | None = None
    sort_order: int | None = None
    kind: str | None = None


class UpdateCycleNodeHandler(CommandHandler[CycleNodeDTO]):
    def __init__(
        self,
        cycle_repo: CycleRepository,
        project_repo: ProjectRepository,
    ) -> None:
        self._cycle_repo = cycle_repo
        self._project_repo = project_repo

    async def handle(self, command: Command) -> CycleNodeDTO:
        assert isinstance(command, UpdateCycleNode)

        project = await self._project_repo.find_by_id(command.project_id)
        if project is None or project.tenant_id != command.tenant_id:
            raise ValidationError("Project not found")

        node = await self._cycle_repo.find_by_id(command.cycle_node_id)
        if node is None or node.project_id != command.project_id:
            raise ValidationError("Cycle node not found")

        name = command.name.strip() if (command.name and command.name.strip()) else node.name
        path = node.path
        if command.name and command.name.strip() and command.name.strip() != node.name:
            name = command.name.strip()
            if node.parent_id is None:
                path = name
            else:
                parent = await self._cycle_repo.find_by_id(node.parent_id)
                path = f"{parent.path}/{name}" if parent else name

        kind = getattr(node, "kind", "iteration") or "iteration"
        if command.kind is not None and command.kind.strip().lower() in ("release", "iteration"):
            kind = command.kind.strip().lower()
        updated = CycleNode(
            id=node.id,
            project_id=node.project_id,
            name=name,
            path=path,
            parent_id=node.parent_id,
            depth=node.depth,
            sort_order=command.sort_order if command.sort_order is not None else node.sort_order,
            goal=command.goal if command.goal is not None else node.goal,
            start_date=command.start_date if command.start_date is not None else node.start_date,
            end_date=command.end_date if command.end_date is not None else node.end_date,
            state=command.state if command.state is not None else node.state,
            kind=kind,
            created_at=node.created_at,
            updated_at=node.updated_at,
        )
        await self._cycle_repo.update(updated)

        refreshed = await self._cycle_repo.find_by_id(command.cycle_node_id)
        assert refreshed is not None
        return CycleNodeDTO(
            id=refreshed.id,
            project_id=refreshed.project_id,
            name=refreshed.name,
            path=refreshed.path,
            parent_id=refreshed.parent_id,
            depth=refreshed.depth,
            sort_order=refreshed.sort_order,
            goal=refreshed.goal,
            start_date=refreshed.start_date,
            end_date=refreshed.end_date,
            state=refreshed.state,
            kind=getattr(refreshed, "kind", "iteration") or "iteration",
            created_at=refreshed.created_at.isoformat() if refreshed.created_at else None,
            updated_at=refreshed.updated_at.isoformat() if refreshed.updated_at else None,
        )

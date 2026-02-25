"""Create cycle node (root or child)."""

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
class CreateCycleNode(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    name: str
    parent_id: uuid.UUID | None = None
    sort_order: int = 0
    goal: str = ""
    start_date: date | None = None
    end_date: date | None = None
    state: str = "planned"


class CreateCycleNodeHandler(CommandHandler[CycleNodeDTO]):
    def __init__(
        self,
        cycle_repo: CycleRepository,
        project_repo: ProjectRepository,
    ) -> None:
        self._cycle_repo = cycle_repo
        self._project_repo = project_repo

    async def handle(self, command: Command) -> CycleNodeDTO:
        assert isinstance(command, CreateCycleNode)

        project = await self._project_repo.find_by_id(command.project_id)
        if project is None or project.tenant_id != command.tenant_id:
            raise ValidationError("Project not found")

        if command.parent_id is None:
            node = CycleNode.create_root(
                project_id=command.project_id,
                name=command.name,
                sort_order=command.sort_order,
                goal=command.goal,
                start_date=command.start_date,
                end_date=command.end_date,
                state=command.state,
            )
        else:
            parent = await self._cycle_repo.find_by_id(command.parent_id)
            if parent is None or parent.project_id != command.project_id:
                raise ValidationError("Parent cycle not found")
            node = CycleNode.create_child(
                project_id=command.project_id,
                name=command.name,
                parent=parent,
                sort_order=command.sort_order,
                goal=command.goal,
                start_date=command.start_date,
                end_date=command.end_date,
                state=command.state,
            )

        await self._cycle_repo.add(node)

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
            created_at=node.created_at.isoformat() if node.created_at else None,
            updated_at=node.updated_at.isoformat() if node.updated_at else None,
        )

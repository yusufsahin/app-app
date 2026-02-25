"""Delete cycle node."""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ValidationError
from alm.cycle.domain.ports import CycleRepository
from alm.project.domain.ports import ProjectRepository


@dataclass(frozen=True)
class DeleteCycleNode(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    cycle_node_id: uuid.UUID


class DeleteCycleNodeHandler(CommandHandler[None]):
    def __init__(
        self,
        cycle_repo: CycleRepository,
        project_repo: ProjectRepository,
    ) -> None:
        self._cycle_repo = cycle_repo
        self._project_repo = project_repo

    async def handle(self, command: Command) -> None:
        assert isinstance(command, DeleteCycleNode)

        project = await self._project_repo.find_by_id(command.project_id)
        if project is None or project.tenant_id != command.tenant_id:
            raise ValidationError("Project not found")

        node = await self._cycle_repo.find_by_id(command.cycle_node_id)
        if node is None or node.project_id != command.project_id:
            raise ValidationError("Cycle node not found")

        await self._cycle_repo.delete(command.cycle_node_id)

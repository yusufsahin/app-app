"""Delete area node."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.area.domain.ports import AreaRepository
from alm.project.domain.ports import ProjectRepository
from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ValidationError


@dataclass(frozen=True)
class DeleteAreaNode(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    area_node_id: uuid.UUID


class DeleteAreaNodeHandler(CommandHandler[None]):
    def __init__(
        self,
        area_repo: AreaRepository,
        project_repo: ProjectRepository,
    ) -> None:
        self._area_repo = area_repo
        self._project_repo = project_repo

    async def handle(self, command: Command) -> None:
        assert isinstance(command, DeleteAreaNode)

        project = await self._project_repo.find_by_id(command.project_id)
        if project is None or project.tenant_id != command.tenant_id:
            raise ValidationError("Project not found")

        node = await self._area_repo.find_by_id(command.area_node_id)
        if node is None or node.project_id != command.project_id:
            raise ValidationError("Area node not found")

        await self._area_repo.delete(command.area_node_id)

"""Delete capacity."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.capacity.domain.ports import CapacityRepository
from alm.project.domain.ports import ProjectRepository
from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ValidationError


@dataclass(frozen=True)
class DeleteCapacity(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    capacity_id: uuid.UUID


class DeleteCapacityHandler(CommandHandler[None]):
    def __init__(self, capacity_repo: CapacityRepository, project_repo: ProjectRepository) -> None:
        self._capacity_repo = capacity_repo
        self._project_repo = project_repo

    async def handle(self, command: Command) -> None:
        assert isinstance(command, DeleteCapacity)
        project = await self._project_repo.find_by_id(command.project_id)
        if project is None or project.tenant_id != command.tenant_id:
            raise ValidationError("Project not found")
        entity = await self._capacity_repo.find_by_id(command.capacity_id)
        if entity is None or entity.project_id != command.project_id:
            raise ValidationError("Capacity not found")
        await self._capacity_repo.delete(command.capacity_id)


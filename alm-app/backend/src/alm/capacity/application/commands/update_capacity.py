"""Update capacity."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.capacity.application.dtos import CapacityDTO
from alm.capacity.domain.ports import CapacityRepository
from alm.project.domain.ports import ProjectRepository
from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ValidationError


@dataclass(frozen=True)
class UpdateCapacity(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    capacity_id: uuid.UUID
    cycle_node_id: uuid.UUID | None = None
    team_id: uuid.UUID | None = None
    user_id: uuid.UUID | None = None
    capacity_value: float | None = None
    unit: str | None = None


class UpdateCapacityHandler(CommandHandler[CapacityDTO]):
    def __init__(self, capacity_repo: CapacityRepository, project_repo: ProjectRepository) -> None:
        self._capacity_repo = capacity_repo
        self._project_repo = project_repo

    async def handle(self, command: Command) -> CapacityDTO:
        assert isinstance(command, UpdateCapacity)
        project = await self._project_repo.find_by_id(command.project_id)
        if project is None or project.tenant_id != command.tenant_id:
            raise ValidationError("Project not found")
        entity = await self._capacity_repo.find_by_id(command.capacity_id)
        if entity is None or entity.project_id != command.project_id:
            raise ValidationError("Capacity not found")

        if command.cycle_node_id is not None:
            entity.cycle_node_id = command.cycle_node_id
        if command.team_id is not None:
            entity.team_id = command.team_id
        if command.user_id is not None:
            entity.user_id = command.user_id
        if entity.team_id is None and entity.user_id is None:
            raise ValidationError("Either team_id or user_id must be provided")
        if command.capacity_value is not None:
            if command.capacity_value < 0:
                raise ValidationError("capacity_value must be >= 0")
            entity.capacity_value = command.capacity_value
        if command.unit is not None:
            entity.unit = (command.unit or "hours").strip() or "hours"

        await self._capacity_repo.update(entity)
        return CapacityDTO(
            id=entity.id,
            project_id=entity.project_id,
            cycle_node_id=entity.cycle_node_id,
            team_id=entity.team_id,
            user_id=entity.user_id,
            capacity_value=entity.capacity_value,
            unit=entity.unit,
            created_at=entity.created_at.isoformat() if entity.created_at else None,
            updated_at=entity.updated_at.isoformat() if entity.updated_at else None,
        )


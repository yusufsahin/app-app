"""Update area node (name, sort_order)."""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ValidationError
from alm.area.application.dtos import AreaNodeDTO
from alm.area.domain.entities import AreaNode
from alm.area.domain.ports import AreaRepository
from alm.project.domain.ports import ProjectRepository


@dataclass(frozen=True)
class UpdateAreaNode(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    area_node_id: uuid.UUID
    name: str | None = None
    sort_order: int | None = None


class UpdateAreaNodeHandler(CommandHandler[AreaNodeDTO]):
    def __init__(
        self,
        area_repo: AreaRepository,
        project_repo: ProjectRepository,
    ) -> None:
        self._area_repo = area_repo
        self._project_repo = project_repo

    async def handle(self, command: Command) -> AreaNodeDTO:
        assert isinstance(command, UpdateAreaNode)

        project = await self._project_repo.find_by_id(command.project_id)
        if project is None or project.tenant_id != command.tenant_id:
            raise ValidationError("Project not found")

        node = await self._area_repo.find_by_id(command.area_node_id)
        if node is None or node.project_id != command.project_id:
            raise ValidationError("Area node not found")

        name = command.name.strip() if (command.name and command.name.strip()) else node.name
        sort_order = command.sort_order if command.sort_order is not None else node.sort_order
        # Path unchanged on simple update; use rename for path change
        updated = AreaNode(
            id=node.id,
            project_id=node.project_id,
            name=name,
            path=node.path,
            parent_id=node.parent_id,
            depth=node.depth,
            sort_order=sort_order,
            is_active=node.is_active,
            created_at=node.created_at,
            updated_at=node.updated_at,
        )
        await self._area_repo.update(updated)

        refreshed = await self._area_repo.find_by_id(command.area_node_id)
        assert refreshed is not None
        return AreaNodeDTO(
            id=refreshed.id,
            project_id=refreshed.project_id,
            name=refreshed.name,
            path=refreshed.path,
            parent_id=refreshed.parent_id,
            depth=refreshed.depth,
            sort_order=refreshed.sort_order,
            is_active=refreshed.is_active,
            created_at=refreshed.created_at.isoformat() if refreshed.created_at else None,
            updated_at=refreshed.updated_at.isoformat() if refreshed.updated_at else None,
        )

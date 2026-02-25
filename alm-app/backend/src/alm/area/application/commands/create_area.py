"""Create area node (root or child)."""
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
class CreateAreaNode(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    name: str
    parent_id: uuid.UUID | None = None
    sort_order: int = 0


class CreateAreaNodeHandler(CommandHandler[AreaNodeDTO]):
    def __init__(
        self,
        area_repo: AreaRepository,
        project_repo: ProjectRepository,
    ) -> None:
        self._area_repo = area_repo
        self._project_repo = project_repo

    async def handle(self, command: Command) -> AreaNodeDTO:
        assert isinstance(command, CreateAreaNode)

        project = await self._project_repo.find_by_id(command.project_id)
        if project is None or project.tenant_id != command.tenant_id:
            raise ValidationError("Project not found")

        if command.parent_id is None:
            node = AreaNode.create_root(
                project_id=command.project_id,
                name=command.name,
                sort_order=command.sort_order,
            )
        else:
            parent = await self._area_repo.find_by_id(command.parent_id)
            if parent is None or parent.project_id != command.project_id:
                raise ValidationError("Parent area not found")
            node = AreaNode.create_child(
                project_id=command.project_id,
                name=command.name,
                parent=parent,
                sort_order=command.sort_order,
            )

        await self._area_repo.add(node)

        return AreaNodeDTO(
            id=node.id,
            project_id=node.project_id,
            name=node.name,
            path=node.path,
            parent_id=node.parent_id,
            depth=node.depth,
            sort_order=node.sort_order,
            is_active=node.is_active,
            created_at=node.created_at.isoformat() if node.created_at else None,
            updated_at=node.updated_at.isoformat() if node.updated_at else None,
        )

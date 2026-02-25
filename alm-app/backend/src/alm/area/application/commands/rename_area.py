"""Rename area node: update name and path; update all descendant paths."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.area.application.dtos import AreaNodeDTO
from alm.area.domain.ports import AreaRepository
from alm.project.domain.ports import ProjectRepository
from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ValidationError


@dataclass(frozen=True)
class RenameAreaNode(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    area_node_id: uuid.UUID
    new_name: str


class RenameAreaNodeHandler(CommandHandler[AreaNodeDTO]):
    def __init__(
        self,
        area_repo: AreaRepository,
        project_repo: ProjectRepository,
    ) -> None:
        self._area_repo = area_repo
        self._project_repo = project_repo

    async def handle(self, command: Command) -> AreaNodeDTO:
        assert isinstance(command, RenameAreaNode)

        project = await self._project_repo.find_by_id(command.project_id)
        if project is None or project.tenant_id != command.tenant_id:
            raise ValidationError("Project not found")

        node = await self._area_repo.find_by_id(command.area_node_id)
        if node is None or node.project_id != command.project_id:
            raise ValidationError("Area node not found")

        new_name = (command.new_name or "").strip()
        if not new_name:
            raise ValidationError("Area name cannot be empty")

        parent_path = ""
        if node.parent_id:
            parent = await self._area_repo.find_by_id(node.parent_id)
            parent_path = parent.path + "/" if parent else ""
        new_path = parent_path + new_name if parent_path else new_name
        old_path = node.path

        if new_path == old_path and node.name == new_name:
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

        existing = await self._area_repo.find_by_project_and_path(command.project_id, new_path)
        if existing is not None and existing.id != node.id:
            raise ValidationError("Area path already exists: " + new_path)

        node.set_name(new_name)
        node.set_path(new_path)
        await self._area_repo.update(node)

        subtree = await self._area_repo.find_by_project_and_path_prefix(command.project_id, old_path)
        for desc in subtree:
            if desc.id == node.id:
                continue
            if desc.path.startswith(old_path + "/"):
                new_desc_path = new_path + desc.path[len(old_path) :]
                desc.set_path(new_desc_path)
                await self._area_repo.update(desc)

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

"""Move area node to new parent; cycle check; update subtree paths/depths."""
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
class MoveAreaNode(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    area_node_id: uuid.UUID
    new_parent_id: uuid.UUID | None  # None = move to root


class MoveAreaNodeHandler(CommandHandler[AreaNodeDTO]):
    def __init__(
        self,
        area_repo: AreaRepository,
        project_repo: ProjectRepository,
    ) -> None:
        self._area_repo = area_repo
        self._project_repo = project_repo

    async def handle(self, command: Command) -> AreaNodeDTO:
        assert isinstance(command, MoveAreaNode)

        project = await self._project_repo.find_by_id(command.project_id)
        if project is None or project.tenant_id != command.tenant_id:
            raise ValidationError("Project not found")

        node = await self._area_repo.find_by_id(command.area_node_id)
        if node is None or node.project_id != command.project_id:
            raise ValidationError("Area node not found")

        old_path = node.path
        new_parent: AreaNode | None = None
        if command.new_parent_id is not None:
            new_parent = await self._area_repo.find_by_id(command.new_parent_id)
            if new_parent is None or new_parent.project_id != command.project_id:
                raise ValidationError("New parent area not found")
            if new_parent.path == old_path or new_parent.path.startswith(old_path + "/"):
                raise ValidationError("Cannot move area under its own descendant (cycle)")
            new_path = new_parent.path + "/" + node.name
            new_depth = new_parent.depth + 1
        else:
            new_path = node.name
            new_depth = 0

        if new_path == old_path:
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

        existing = await self._area_repo.find_by_project_and_path(
            command.project_id, new_path
        )
        if existing is not None:
            raise ValidationError("Area path already exists: " + new_path)

        depth_delta = new_depth - node.depth
        node.set_path(new_path)
        node.set_depth(new_depth)
        node.set_parent_id(new_parent.id if new_parent else None)
        await self._area_repo.update(node)

        subtree = await self._area_repo.find_by_project_and_path_prefix(
            command.project_id, old_path
        )
        for desc in subtree:
            if desc.id == node.id:
                continue
            if desc.path.startswith(old_path + "/"):
                desc_new_path = new_path + desc.path[len(old_path) :]
                desc.set_path(desc_new_path)
                desc.set_depth(desc.depth + depth_delta)
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

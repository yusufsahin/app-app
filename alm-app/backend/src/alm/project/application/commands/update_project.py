"""Update project (partial update)."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any

from alm.project.application.dtos import ProjectDTO
from alm.project.domain.ports import ProjectRepository
from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ValidationError


@dataclass(frozen=True)
class UpdateProject(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    name: str | None = None
    description: str | None = None
    status: str | None = None
    settings: dict[str, Any] | None = None
    metadata_: dict[str, Any] | None = None


class UpdateProjectHandler(CommandHandler[ProjectDTO]):
    def __init__(self, project_repo: ProjectRepository) -> None:
        self._project_repo = project_repo

    async def handle(self, command: Command) -> ProjectDTO:
        assert isinstance(command, UpdateProject)

        project = await self._project_repo.find_by_id(command.project_id)
        if project is None or project.tenant_id != command.tenant_id:
            raise ValidationError("Project not found")

        if command.name is not None:
            project.name = command.name.strip() or project.name
        if command.description is not None:
            project.description = command.description
        if command.status is not None:
            project.status = command.status.strip() or None
        if command.settings is not None:
            project.settings = command.settings
        if command.metadata_ is not None:
            project.metadata_ = command.metadata_

        await self._project_repo.update(project)

        return ProjectDTO(
            id=project.id,
            code=project.code,
            name=project.name,
            slug=project.slug,
            description=project.description,
            status=project.status,
            settings=project.settings,
            metadata_=project.metadata_,
        )

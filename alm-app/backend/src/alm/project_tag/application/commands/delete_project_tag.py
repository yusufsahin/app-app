"""Delete a project tag (removes it from all artifacts — ADO-style)."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.project.domain.ports import ProjectRepository
from alm.project_tag.domain.ports import ProjectTagRepository
from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import EntityNotFound, ValidationError


@dataclass(frozen=True)
class DeleteProjectTag(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    tag_id: uuid.UUID


class DeleteProjectTagHandler(CommandHandler[None]):
    def __init__(
        self,
        project_repo: ProjectRepository,
        tag_repo: ProjectTagRepository,
    ) -> None:
        self._project_repo = project_repo
        self._tag_repo = tag_repo

    async def handle(self, command: Command) -> None:
        assert isinstance(command, DeleteProjectTag)
        project = await self._project_repo.find_by_id(command.project_id)
        if project is None or project.tenant_id != command.tenant_id:
            raise ValidationError("Project not found")
        ok = await self._tag_repo.delete(command.project_id, command.tag_id)
        if not ok:
            raise EntityNotFound("ProjectTag", command.tag_id)

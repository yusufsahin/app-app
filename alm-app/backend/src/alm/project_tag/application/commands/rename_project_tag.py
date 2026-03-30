"""Rename a project tag (applies to all artifacts using it — ADO-style)."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from sqlalchemy.exc import IntegrityError

from alm.project.domain.ports import ProjectRepository
from alm.project_tag.application.dtos import ProjectTagDTO
from alm.project_tag.domain.ports import ProjectTagRepository
from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import EntityNotFound, ValidationError


@dataclass(frozen=True)
class RenameProjectTag(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    tag_id: uuid.UUID
    name: str


class RenameProjectTagHandler(CommandHandler[ProjectTagDTO]):
    def __init__(
        self,
        project_repo: ProjectRepository,
        tag_repo: ProjectTagRepository,
    ) -> None:
        self._project_repo = project_repo
        self._tag_repo = tag_repo

    async def handle(self, command: Command) -> ProjectTagDTO:
        assert isinstance(command, RenameProjectTag)
        project = await self._project_repo.find_by_id(command.project_id)
        if project is None or project.tenant_id != command.tenant_id:
            raise ValidationError("Project not found")
        try:
            ok = await self._tag_repo.rename(command.project_id, command.tag_id, command.name)
        except ValueError as e:
            raise ValidationError(str(e)) from e
        except IntegrityError as e:
            raise ValidationError("A tag with this name already exists in the project") from e
        if not ok:
            raise EntityNotFound("ProjectTag", command.tag_id)
        refreshed = await self._tag_repo.find_by_id(command.project_id, command.tag_id)
        if refreshed is None:
            raise EntityNotFound("ProjectTag", command.tag_id)
        return refreshed

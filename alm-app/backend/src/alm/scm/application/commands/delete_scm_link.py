"""Delete SCM link."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.artifact.domain.ports import ArtifactRepository
from alm.project.domain.ports import ProjectRepository
from alm.scm.domain.ports import ScmLinkRepository
from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ValidationError


@dataclass(frozen=True)
class DeleteScmLink(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    artifact_id: uuid.UUID
    link_id: uuid.UUID


class DeleteScmLinkHandler(CommandHandler[None]):
    def __init__(
        self,
        scm_repo: ScmLinkRepository,
        artifact_repo: ArtifactRepository,
        project_repo: ProjectRepository,
    ) -> None:
        self._scm_repo = scm_repo
        self._artifact_repo = artifact_repo
        self._project_repo = project_repo

    async def handle(self, command: Command) -> None:
        assert isinstance(command, DeleteScmLink)

        project = await self._project_repo.find_by_id(command.project_id)
        if project is None or project.tenant_id != command.tenant_id:
            raise ValidationError("Project not found")

        artifact = await self._artifact_repo.find_by_id(command.artifact_id)
        if artifact is None or artifact.project_id != command.project_id:
            raise ValidationError("Artifact not found")

        link = await self._scm_repo.find_by_id(command.link_id)
        if link is None or link.artifact_id != command.artifact_id or link.project_id != command.project_id:
            raise ValidationError("SCM link not found")

        await self._scm_repo.delete(command.link_id)

"""Soft-delete an artifact."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.artifact.domain.ports import ArtifactRepository
from alm.project.domain.ports import ProjectRepository
from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ValidationError


@dataclass(frozen=True)
class DeleteArtifact(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    artifact_id: uuid.UUID
    deleted_by: uuid.UUID | None = None


class DeleteArtifactHandler(CommandHandler[None]):
    def __init__(
        self,
        artifact_repo: ArtifactRepository,
        project_repo: ProjectRepository,
    ) -> None:
        self._artifact_repo = artifact_repo
        self._project_repo = project_repo

    async def handle(self, command: Command) -> None:
        assert isinstance(command, DeleteArtifact)

        project = await self._project_repo.find_by_id(command.project_id)
        if project is None or project.tenant_id != command.tenant_id:
            raise ValidationError("Project not found")

        artifact = await self._artifact_repo.find_by_id(command.artifact_id)
        if artifact is None or artifact.project_id != command.project_id:
            raise ValidationError("Artifact not found")

        if artifact.is_deleted:
            raise ValidationError("Artifact is already deleted")

        artifact.soft_delete(by=command.deleted_by or command.tenant_id)
        await self._artifact_repo.update(artifact)
        return None

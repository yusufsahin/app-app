"""Create artifact link (traceability)."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.artifact.domain.ports import ArtifactRepository
from alm.artifact_link.application.dtos import ArtifactLinkDTO
from alm.artifact_link.domain.entities import ArtifactLink
from alm.artifact_link.domain.ports import ArtifactLinkRepository
from alm.project.domain.ports import ProjectRepository
from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ValidationError


@dataclass(frozen=True)
class CreateArtifactLink(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    from_artifact_id: uuid.UUID
    to_artifact_id: uuid.UUID
    link_type: str


class CreateArtifactLinkHandler(CommandHandler[ArtifactLinkDTO]):
    def __init__(
        self,
        link_repo: ArtifactLinkRepository,
        artifact_repo: ArtifactRepository,
        project_repo: ProjectRepository,
    ) -> None:
        self._link_repo = link_repo
        self._artifact_repo = artifact_repo
        self._project_repo = project_repo

    async def handle(self, command: Command) -> ArtifactLinkDTO:
        assert isinstance(command, CreateArtifactLink)

        project = await self._project_repo.find_by_id(command.project_id)
        if project is None or project.tenant_id != command.tenant_id:
            raise ValidationError("Project not found")

        if command.from_artifact_id == command.to_artifact_id:
            raise ValidationError("Cannot link an artifact to itself")

        from_art = await self._artifact_repo.find_by_id(command.from_artifact_id)
        if from_art is None or from_art.project_id != command.project_id:
            raise ValidationError("Source artifact not found")

        to_art = await self._artifact_repo.find_by_id(command.to_artifact_id)
        if to_art is None or to_art.project_id != command.project_id:
            raise ValidationError("Target artifact not found")

        link_type = (command.link_type or "related").strip().lower() or "related"
        if await self._link_repo.exists(
            command.from_artifact_id,
            command.to_artifact_id,
            link_type,
        ):
            raise ValidationError("Link already exists between these artifacts with this type")

        link = ArtifactLink.create(
            project_id=command.project_id,
            from_artifact_id=command.from_artifact_id,
            to_artifact_id=command.to_artifact_id,
            link_type=link_type,
        )
        await self._link_repo.add(link)

        return ArtifactLinkDTO(
            id=link.id,
            project_id=link.project_id,
            from_artifact_id=link.from_artifact_id,
            to_artifact_id=link.to_artifact_id,
            link_type=link.link_type,
            created_at=link.created_at.isoformat() if link.created_at else None,
        )

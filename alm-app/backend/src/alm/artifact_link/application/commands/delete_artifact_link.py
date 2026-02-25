"""Delete artifact link."""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ValidationError
from alm.artifact_link.domain.ports import ArtifactLinkRepository


@dataclass(frozen=True)
class DeleteArtifactLink(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    artifact_id: uuid.UUID
    link_id: uuid.UUID


class DeleteArtifactLinkHandler(CommandHandler[bool]):
    def __init__(self, link_repo: ArtifactLinkRepository) -> None:
        self._link_repo = link_repo

    async def handle(self, command: Command) -> bool:
        assert isinstance(command, DeleteArtifactLink)

        link = await self._link_repo.find_by_id(command.link_id)
        if link is None:
            raise ValidationError("Link not found")
        if link.project_id != command.project_id:
            raise ValidationError("Link not found")
        if link.from_artifact_id != command.artifact_id and link.to_artifact_id != command.artifact_id:
            raise ValidationError("Link does not belong to this artifact")

        return await self._link_repo.delete(command.link_id)

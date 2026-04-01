"""Delete an artifact relationship."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.relationship.application.dtos import ArtifactRelationshipDTO
from alm.relationship.domain.ports import RelationshipRepository
from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ValidationError


@dataclass(frozen=True)
class DeleteRelationship(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    artifact_id: uuid.UUID
    relationship_id: uuid.UUID


class DeleteRelationshipHandler(CommandHandler[ArtifactRelationshipDTO | None]):
    def __init__(self, relationship_repo: RelationshipRepository) -> None:
        self._relationship_repo = relationship_repo

    async def handle(self, command: Command) -> ArtifactRelationshipDTO | None:
        assert isinstance(command, DeleteRelationship)

        link = await self._relationship_repo.find_by_id(command.relationship_id)
        if link is None or link.project_id != command.project_id:
            raise ValidationError("Relationship not found")
        if command.artifact_id not in {link.source_artifact_id, link.target_artifact_id}:
            raise ValidationError("Relationship does not belong to this artifact")
        await self._relationship_repo.delete(command.relationship_id)
        return ArtifactRelationshipDTO(
            id=link.id,
            project_id=link.project_id,
            source_artifact_id=link.source_artifact_id,
            target_artifact_id=link.target_artifact_id,
            relationship_type=link.relationship_type,
            created_at=link.created_at.isoformat() if link.created_at else None,
            sort_order=link.sort_order,
        )

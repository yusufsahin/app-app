"""Create an artifact relationship."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from sqlalchemy.exc import IntegrityError

from alm.artifact.domain.ports import ArtifactRepository
from alm.project.domain.ports import ProjectRepository
from alm.relationship.application.dtos import ArtifactRelationshipDTO
from alm.relationship.domain.entities import Relationship
from alm.relationship.domain.ports import RelationshipRepository
from alm.relationship.domain.types import (
    RELATED,
    SUITE_INCLUDES_TEST,
    get_relationship_type,
    relationship_type_allowed,
)
from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ValidationError


@dataclass(frozen=True)
class CreateRelationship(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    source_artifact_id: uuid.UUID
    target_artifact_id: uuid.UUID
    relationship_type: str
    manifest_bundle: dict | None = None


class CreateRelationshipHandler(CommandHandler[ArtifactRelationshipDTO]):
    def __init__(
        self,
        relationship_repo: RelationshipRepository,
        artifact_repo: ArtifactRepository,
        project_repo: ProjectRepository,
    ) -> None:
        self._relationship_repo = relationship_repo
        self._artifact_repo = artifact_repo
        self._project_repo = project_repo

    async def handle(self, command: Command) -> ArtifactRelationshipDTO:
        assert isinstance(command, CreateRelationship)

        project = await self._project_repo.find_by_id(command.project_id)
        if project is None or project.tenant_id != command.tenant_id:
            raise ValidationError("Project not found")

        if command.source_artifact_id == command.target_artifact_id:
            raise ValidationError("Cannot relate an artifact to itself")

        source = await self._artifact_repo.find_by_id(command.source_artifact_id)
        if source is None or source.project_id != command.project_id:
            raise ValidationError("Source artifact not found")

        target = await self._artifact_repo.find_by_id(command.target_artifact_id)
        if target is None or target.project_id != command.project_id:
            raise ValidationError("Target artifact not found")

        relationship_type = (command.relationship_type or RELATED).strip().lower() or RELATED
        rel_type = get_relationship_type(command.manifest_bundle, relationship_type)
        if not relationship_type_allowed(rel_type, source.artifact_type, target.artifact_type):
            raise ValidationError(
                f"Relationship '{relationship_type}' is not allowed from "
                f"'{source.artifact_type}' to '{target.artifact_type}'"
            )

        if await self._relationship_repo.exists(command.source_artifact_id, command.target_artifact_id, relationship_type):
            raise ValidationError("Relationship already exists between these artifacts with this type")

        sort_order: int | None = None
        if relationship_type == SUITE_INCLUDES_TEST:
            mx = await self._relationship_repo.max_sort_order_for_outgoing(
                command.project_id,
                command.source_artifact_id,
                relationship_type,
            )
            sort_order = (mx + 1) if mx is not None else 0

        relationship = Relationship.create(
            project_id=command.project_id,
            source_artifact_id=command.source_artifact_id,
            target_artifact_id=command.target_artifact_id,
            relationship_type=relationship_type,
            sort_order=sort_order,
        )
        try:
            await self._relationship_repo.add(relationship)
        except IntegrityError as exc:
            raise ValidationError("Relationship already exists between these artifacts with this type") from exc

        return ArtifactRelationshipDTO(
            id=relationship.id,
            project_id=relationship.project_id,
            source_artifact_id=relationship.source_artifact_id,
            target_artifact_id=relationship.target_artifact_id,
            relationship_type=relationship.relationship_type,
            created_at=relationship.created_at.isoformat() if relationship.created_at else None,
            sort_order=relationship.sort_order,
        )

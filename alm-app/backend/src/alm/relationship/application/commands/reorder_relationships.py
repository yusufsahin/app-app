"""Reorder outgoing relationships for ordering-aware relationship types."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.project.domain.ports import ProjectRepository
from alm.relationship.domain.ports import RelationshipRepository
from alm.relationship.domain.types import get_relationship_type
from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ValidationError


@dataclass(frozen=True)
class ReorderOutgoingRelationships(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    source_artifact_id: uuid.UUID
    relationship_type: str
    ordered_relationship_ids: list[uuid.UUID]
    manifest_bundle: dict | None = None


class ReorderOutgoingRelationshipsHandler(CommandHandler[None]):
    def __init__(
        self,
        relationship_repo: RelationshipRepository,
        project_repo: ProjectRepository,
    ) -> None:
        self._relationship_repo = relationship_repo
        self._project_repo = project_repo

    async def handle(self, command: Command) -> None:
        assert isinstance(command, ReorderOutgoingRelationships)

        project = await self._project_repo.find_by_id(command.project_id)
        if project is None or project.tenant_id != command.tenant_id:
            raise ValidationError("Project not found")

        relationship_type = (command.relationship_type or "").strip().lower()
        if not relationship_type:
            raise ValidationError("relationship_type is required")

        rel_type = get_relationship_type(command.manifest_bundle, relationship_type)
        if not rel_type.supports_ordering:
            raise ValidationError(f"Relationship type '{relationship_type}' does not support ordering")

        current = await self._relationship_repo.list_outgoing_relationship_ids(
            command.project_id,
            command.source_artifact_id,
            relationship_type,
        )
        current_set = set(current)
        ordered = command.ordered_relationship_ids
        if len(ordered) != len(current_set) or set(ordered) != current_set:
            raise ValidationError(
                "ordered_relationship_ids must contain exactly the same relationship ids as existing outgoing relationships"
            )

        await self._relationship_repo.set_sort_orders_for_outgoing(
            command.project_id,
            command.source_artifact_id,
            relationship_type,
            ordered,
        )

"""List available relationship types for a source artifact."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.artifact.domain.ports import ArtifactRepository
from alm.project.domain.ports import ProjectRepository
from alm.relationship.application.dtos import RelationshipTypeOptionDTO
from alm.relationship.domain.types import resolve_relationship_types
from alm.shared.application.query import Query, QueryHandler
from alm.shared.domain.exceptions import ValidationError


@dataclass(frozen=True)
class ListRelationshipTypeOptions(Query):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    artifact_id: uuid.UUID
    manifest_bundle: dict | None = None


class ListRelationshipTypeOptionsHandler(QueryHandler[list[RelationshipTypeOptionDTO]]):
    def __init__(
        self,
        artifact_repo: ArtifactRepository,
        project_repo: ProjectRepository,
    ) -> None:
        self._artifact_repo = artifact_repo
        self._project_repo = project_repo

    async def handle(self, query: Query) -> list[RelationshipTypeOptionDTO]:
        assert isinstance(query, ListRelationshipTypeOptions)

        project = await self._project_repo.find_by_id(query.project_id)
        if project is None or project.tenant_id != query.tenant_id:
            raise ValidationError("Project not found")

        artifact = await self._artifact_repo.find_by_id(query.artifact_id)
        if artifact is None or artifact.project_id != query.project_id:
            raise ValidationError("Artifact not found")

        resolved = resolve_relationship_types(query.manifest_bundle)
        options: list[RelationshipTypeOptionDTO] = []
        for rel_type in resolved.values():
            if rel_type.allowed_source_types and artifact.artifact_type not in rel_type.allowed_source_types:
                continue
            options.append(
                RelationshipTypeOptionDTO(
                    key=rel_type.key,
                    label=rel_type.forward_label,
                    reverse_label=rel_type.reverse_label,
                    category=rel_type.category,
                    directionality=rel_type.directionality,
                    allowed_target_types=rel_type.allowed_target_types,
                    description=rel_type.description,
                )
            )
        options.sort(key=lambda item: (item.category, item.label.lower(), item.key))
        return options

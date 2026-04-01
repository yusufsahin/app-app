"""List relationships for a single artifact with detail-first projection."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.artifact.domain.ports import ArtifactRepository
from alm.project.domain.ports import ProjectRepository
from alm.relationship.application.dtos import ArtifactRelationshipViewDTO
from alm.relationship.domain.ports import RelationshipRepository
from alm.relationship.domain.types import get_relationship_type
from alm.shared.application.query import Query, QueryHandler
from alm.shared.domain.exceptions import ValidationError


@dataclass(frozen=True)
class ListRelationshipsForArtifact(Query):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    artifact_id: uuid.UUID
    manifest_bundle: dict | None = None


class ListRelationshipsForArtifactHandler(QueryHandler[list[ArtifactRelationshipViewDTO]]):
    def __init__(
        self,
        relationship_repo: RelationshipRepository,
        artifact_repo: ArtifactRepository,
        project_repo: ProjectRepository,
    ) -> None:
        self._relationship_repo = relationship_repo
        self._artifact_repo = artifact_repo
        self._project_repo = project_repo

    async def handle(self, query: Query) -> list[ArtifactRelationshipViewDTO]:
        assert isinstance(query, ListRelationshipsForArtifact)

        project = await self._project_repo.find_by_id(query.project_id)
        if project is None or project.tenant_id != query.tenant_id:
            raise ValidationError("Project not found")

        current = await self._artifact_repo.find_by_id(query.artifact_id)
        if current is None or current.project_id != query.project_id:
            raise ValidationError("Artifact not found")

        links = await self._relationship_repo.list_by_artifact(query.project_id, query.artifact_id)
        other_ids = [
            link.target_artifact_id if link.source_artifact_id == query.artifact_id else link.source_artifact_id
            for link in links
        ]
        other_by_id = {
            artifact.id: artifact
            for artifact in await self._artifact_repo.list_by_ids_in_project(query.project_id, other_ids)
        }

        results: list[ArtifactRelationshipViewDTO] = []
        for link in links:
            is_outgoing = link.source_artifact_id == query.artifact_id
            other_id = link.target_artifact_id if is_outgoing else link.source_artifact_id
            other = other_by_id.get(other_id)
            rel_type = get_relationship_type(query.manifest_bundle, link.relationship_type)
            results.append(
                ArtifactRelationshipViewDTO(
                    id=link.id,
                    project_id=link.project_id,
                    source_artifact_id=link.source_artifact_id,
                    target_artifact_id=link.target_artifact_id,
                    other_artifact_id=other_id,
                    other_artifact_type=other.artifact_type if other else None,
                    other_artifact_key=other.artifact_key if other else None,
                    other_artifact_title=other.title if other else str(other_id),
                    relationship_type=link.relationship_type,
                    direction="outgoing" if is_outgoing else "incoming",
                    category=rel_type.category,
                    display_label=rel_type.forward_label if is_outgoing else rel_type.reverse_label,
                    created_at=link.created_at.isoformat() if link.created_at else None,
                    sort_order=link.sort_order,
                )
            )
        return results

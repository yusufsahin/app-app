"""Get artifact by ID."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.artifact.application.dtos import ArtifactDTO
from alm.artifact.domain.ports import ArtifactRepository
from alm.project.domain.ports import ProjectRepository
from alm.shared.application.query import Query, QueryHandler


@dataclass(frozen=True)
class GetArtifact(Query):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    artifact_id: uuid.UUID


class GetArtifactHandler(QueryHandler[ArtifactDTO | None]):
    def __init__(
        self,
        artifact_repo: ArtifactRepository,
        project_repo: ProjectRepository,
    ) -> None:
        self._artifact_repo = artifact_repo
        self._project_repo = project_repo

    async def handle(self, query: Query) -> ArtifactDTO | None:
        assert isinstance(query, GetArtifact)

        project = await self._project_repo.find_by_id(query.project_id)
        if project is None or project.tenant_id != query.tenant_id:
            return None

        artifact = await self._artifact_repo.find_by_id(query.artifact_id)
        if artifact is None or artifact.project_id != query.project_id:
            return None

        return ArtifactDTO(
            id=artifact.id,
            project_id=artifact.project_id,
            artifact_type=artifact.artifact_type,
            title=artifact.title,
            description=artifact.description,
            state=artifact.state,
            assignee_id=artifact.assignee_id,
            parent_id=artifact.parent_id,
            custom_fields=artifact.custom_fields,
            artifact_key=artifact.artifact_key,
            state_reason=artifact.state_reason,
            resolution=artifact.resolution,
            rank_order=artifact.rank_order,
            cycle_node_id=getattr(artifact, "cycle_node_id", None),
            area_node_id=getattr(artifact, "area_node_id", None),
            area_path_snapshot=getattr(artifact, "area_path_snapshot", None),
            created_at=getattr(artifact, "created_at", None),
            updated_at=getattr(artifact, "updated_at", None),
        )

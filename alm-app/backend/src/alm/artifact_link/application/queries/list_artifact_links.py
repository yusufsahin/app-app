"""List artifact links for an artifact (both directions)."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.artifact_link.application.dtos import ArtifactLinkDTO
from alm.artifact_link.domain.ports import ArtifactLinkRepository
from alm.shared.application.query import Query, QueryHandler


@dataclass(frozen=True)
class ListArtifactLinks(Query):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    artifact_id: uuid.UUID


class ListArtifactLinksHandler(QueryHandler[list[ArtifactLinkDTO]]):
    def __init__(self, link_repo: ArtifactLinkRepository) -> None:
        self._link_repo = link_repo

    async def handle(self, query: Query) -> list[ArtifactLinkDTO]:
        assert isinstance(query, ListArtifactLinks)

        links = await self._link_repo.list_by_artifact(
            query.project_id,
            query.artifact_id,
        )
        return [
            ArtifactLinkDTO(
                id=link.id,
                project_id=link.project_id,
                from_artifact_id=link.from_artifact_id,
                to_artifact_id=link.to_artifact_id,
                link_type=link.link_type,
                created_at=link.created_at.isoformat() if link.created_at else None,
            )
            for link in links
        ]

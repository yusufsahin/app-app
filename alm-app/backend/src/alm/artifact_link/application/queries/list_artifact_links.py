"""List artifact links for an artifact (both directions)."""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.query import Query, QueryHandler
from alm.artifact_link.application.dtos import ArtifactLinkDTO
from alm.artifact_link.domain.ports import ArtifactLinkRepository


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
                id=l.id,
                project_id=l.project_id,
                from_artifact_id=l.from_artifact_id,
                to_artifact_id=l.to_artifact_id,
                link_type=l.link_type,
                created_at=l.created_at.isoformat() if l.created_at else None,
            )
            for l in links
        ]

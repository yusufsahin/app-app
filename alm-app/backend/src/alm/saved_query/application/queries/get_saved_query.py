"""Get single saved query by id."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.saved_query.application.dtos import SavedQueryDTO
from alm.saved_query.domain.ports import SavedQueryRepository
from alm.shared.application.query import Query, QueryHandler


@dataclass(frozen=True)
class GetSavedQuery(Query):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    query_id: uuid.UUID


class GetSavedQueryHandler(QueryHandler[SavedQueryDTO | None]):
    def __init__(self, saved_query_repo: SavedQueryRepository) -> None:
        self._saved_query_repo = saved_query_repo

    async def handle(self, query: Query) -> SavedQueryDTO | None:
        assert isinstance(query, GetSavedQuery)

        saved = await self._saved_query_repo.find_by_id(query.query_id)
        if saved is None or saved.project_id != query.project_id:
            return None
        return SavedQueryDTO(
            id=saved.id,
            project_id=saved.project_id,
            name=saved.name,
            owner_id=saved.owner_id,
            visibility=saved.visibility,
            filter_params=saved.filter_params,
            created_at=saved.created_at.isoformat() if saved.created_at else None,
            updated_at=saved.updated_at.isoformat() if saved.updated_at else None,
        )

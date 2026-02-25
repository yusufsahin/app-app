"""List saved queries for a project."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.saved_query.application.dtos import SavedQueryDTO
from alm.saved_query.domain.ports import SavedQueryRepository
from alm.shared.application.query import Query, QueryHandler


@dataclass(frozen=True)
class ListSavedQueries(Query):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    user_id: uuid.UUID | None = None  # if set, include private queries owned by this user


class ListSavedQueriesHandler(QueryHandler[list[SavedQueryDTO]]):
    def __init__(self, saved_query_repo: SavedQueryRepository) -> None:
        self._saved_query_repo = saved_query_repo

    async def handle(self, query: Query) -> list[SavedQueryDTO]:
        assert isinstance(query, ListSavedQueries)

        items = await self._saved_query_repo.list_by_project(
            query.project_id,
            include_private_for_user=query.user_id,
        )
        return [
            SavedQueryDTO(
                id=q.id,
                project_id=q.project_id,
                name=q.name,
                owner_id=q.owner_id,
                visibility=q.visibility,
                filter_params=q.filter_params,
                created_at=q.created_at.isoformat() if q.created_at else None,
                updated_at=q.updated_at.isoformat() if q.updated_at else None,
            )
            for q in items
        ]

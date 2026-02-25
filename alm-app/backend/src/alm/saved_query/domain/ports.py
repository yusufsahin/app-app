"""SavedQuery repository port."""
from __future__ import annotations

import uuid
from abc import abstractmethod

from alm.saved_query.domain.entities import SavedQuery


class SavedQueryRepository:
    @abstractmethod
    async def find_by_id(self, query_id: uuid.UUID) -> SavedQuery | None:
        ...

    @abstractmethod
    async def list_by_project(
        self,
        project_id: uuid.UUID,
        *,
        include_private_for_user: uuid.UUID | None = None,
    ) -> list[SavedQuery]:
        """List queries: project visibility + optional private ones for a user."""
        ...

    @abstractmethod
    async def add(self, saved_query: SavedQuery) -> SavedQuery:
        ...

    @abstractmethod
    async def update(self, saved_query: SavedQuery) -> SavedQuery:
        ...

    @abstractmethod
    async def delete(self, query_id: uuid.UUID) -> bool:
        ...

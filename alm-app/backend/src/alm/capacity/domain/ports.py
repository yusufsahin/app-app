"""Capacity repository port."""

from __future__ import annotations

import uuid
from abc import abstractmethod

from alm.capacity.domain.entities import Capacity


class CapacityRepository:
    @abstractmethod
    async def find_by_id(self, capacity_id: uuid.UUID) -> Capacity | None: ...

    @abstractmethod
    async def list_by_project(
        self,
        project_id: uuid.UUID,
        cycle_id: uuid.UUID | None = None,
        team_id: uuid.UUID | None = None,
        user_id: uuid.UUID | None = None,
    ) -> list[Capacity]: ...

    @abstractmethod
    async def add(self, capacity: Capacity) -> Capacity: ...

    @abstractmethod
    async def update(self, capacity: Capacity) -> Capacity: ...

    @abstractmethod
    async def delete(self, capacity_id: uuid.UUID) -> bool: ...


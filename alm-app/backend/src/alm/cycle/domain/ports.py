"""Cadence repository port."""

from __future__ import annotations

import uuid
from abc import abstractmethod

from alm.cycle.domain.entities import Cadence


class CycleRepository:
    @abstractmethod
    async def find_by_id(self, cadence_id: uuid.UUID) -> Cadence | None: ...

    @abstractmethod
    async def list_by_project(self, project_id: uuid.UUID) -> list[Cadence]:
        """List all nodes for project, ordered by path (tree order)."""
        ...

    @abstractmethod
    async def add(self, node: Cadence) -> Cadence: ...

    @abstractmethod
    async def update(self, node: Cadence) -> Cadence: ...

    @abstractmethod
    async def delete(self, cadence_id: uuid.UUID) -> bool: ...

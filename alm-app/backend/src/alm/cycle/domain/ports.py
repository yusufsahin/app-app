"""CycleNode repository port."""

from __future__ import annotations

import uuid
from abc import abstractmethod

from alm.cycle.domain.entities import CycleNode


class CycleRepository:
    @abstractmethod
    async def find_by_id(self, cycle_node_id: uuid.UUID) -> CycleNode | None: ...

    @abstractmethod
    async def list_by_project(self, project_id: uuid.UUID) -> list[CycleNode]:
        """List all nodes for project, ordered by path (tree order)."""
        ...

    @abstractmethod
    async def add(self, node: CycleNode) -> CycleNode: ...

    @abstractmethod
    async def update(self, node: CycleNode) -> CycleNode: ...

    @abstractmethod
    async def delete(self, cycle_node_id: uuid.UUID) -> bool: ...

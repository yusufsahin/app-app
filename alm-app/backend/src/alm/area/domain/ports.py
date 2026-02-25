"""AreaNode repository port."""
from __future__ import annotations

import uuid
from abc import abstractmethod

from alm.area.domain.entities import AreaNode


class AreaRepository:
    @abstractmethod
    async def find_by_id(self, area_node_id: uuid.UUID) -> AreaNode | None:
        ...

    @abstractmethod
    async def list_by_project(self, project_id: uuid.UUID) -> list[AreaNode]:
        """List all nodes for project, ordered by path (tree order)."""
        ...

    @abstractmethod
    async def find_by_project_and_path(
        self, project_id: uuid.UUID, path: str
    ) -> AreaNode | None:
        """Find single node by project and path string."""
        ...

    @abstractmethod
    async def find_by_project_and_path_prefix(
        self, project_id: uuid.UUID, path_prefix: str
    ) -> list[AreaNode]:
        """Node with path = path_prefix plus all descendants (path starting with path_prefix + '/'). For rename/move subtree update."""
        ...

    @abstractmethod
    async def add(self, node: AreaNode) -> AreaNode:
        ...

    @abstractmethod
    async def update(self, node: AreaNode) -> AreaNode:
        ...

    @abstractmethod
    async def delete(self, area_node_id: uuid.UUID) -> bool:
        ...

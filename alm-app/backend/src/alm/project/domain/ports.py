from __future__ import annotations

import uuid
from abc import ABC, abstractmethod

from alm.project.domain.entities import Project


class ProjectRepository(ABC):
    @abstractmethod
    async def add(self, project: Project) -> Project: ...

    @abstractmethod
    async def find_by_id(self, project_id: uuid.UUID) -> Project | None: ...

    @abstractmethod
    async def find_by_tenant_and_slug(
        self, tenant_id: uuid.UUID, slug: str
    ) -> Project | None: ...

    @abstractmethod
    async def find_by_tenant_and_code(
        self, tenant_id: uuid.UUID, code: str
    ) -> Project | None: ...

    @abstractmethod
    async def list_by_tenant(self, tenant_id: uuid.UUID) -> list[Project]: ...

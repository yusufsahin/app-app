from __future__ import annotations

import uuid
from abc import ABC, abstractmethod

from alm.project.domain.entities import Project
from alm.project.domain.project_member import ProjectMember


class ProjectRepository(ABC):
    @abstractmethod
    async def add(self, project: Project) -> Project: ...

    @abstractmethod
    async def find_by_id(self, project_id: uuid.UUID) -> Project | None: ...

    @abstractmethod
    async def find_by_tenant_and_slug(self, tenant_id: uuid.UUID, slug: str) -> Project | None: ...

    @abstractmethod
    async def find_by_tenant_and_code(self, tenant_id: uuid.UUID, code: str) -> Project | None: ...

    @abstractmethod
    async def list_by_tenant(self, tenant_id: uuid.UUID) -> list[Project]: ...

    @abstractmethod
    async def increment_artifact_seq(self, project_id: uuid.UUID) -> int:
        """Increment project artifact sequence and return new value (for artifact_key)."""
        ...

    @abstractmethod
    async def update(self, project: Project) -> Project:
        """Update project (name, description, status, settings, metadata_)."""
        ...


class ProjectMemberRepository(ABC):
    """Port for project membership persistence."""

    @abstractmethod
    async def add(self, member: ProjectMember) -> ProjectMember: ...

    @abstractmethod
    async def find_by_project_and_user(self, project_id: uuid.UUID, user_id: uuid.UUID) -> ProjectMember | None: ...

    @abstractmethod
    async def list_by_project(self, project_id: uuid.UUID) -> list[ProjectMember]: ...

    @abstractmethod
    async def delete_by_project_and_user(self, project_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        """Remove membership; returns True if deleted, False if not found."""
        ...

    @abstractmethod
    async def update(self, member: ProjectMember) -> ProjectMember:
        """Update member (e.g. role)."""
        ...

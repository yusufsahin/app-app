"""Ports for project tag persistence."""

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod

from alm.project_tag.application.dtos import ProjectTagDTO


class ProjectTagRepository(ABC):
    @abstractmethod
    async def list_by_project(self, project_id: uuid.UUID) -> list[ProjectTagDTO]: ...

    @abstractmethod
    async def find_by_id(self, project_id: uuid.UUID, tag_id: uuid.UUID) -> ProjectTagDTO | None: ...

    @abstractmethod
    async def create(self, project_id: uuid.UUID, name: str) -> ProjectTagDTO:
        """Insert tag; caller must enforce uniqueness (project + lower(name))."""
        ...

    @abstractmethod
    async def rename(self, project_id: uuid.UUID, tag_id: uuid.UUID, new_name: str) -> bool: ...

    @abstractmethod
    async def delete(self, project_id: uuid.UUID, tag_id: uuid.UUID) -> bool: ...

    @abstractmethod
    async def validate_tag_ids_for_project(self, project_id: uuid.UUID, tag_ids: list[uuid.UUID]) -> bool:
        """True iff every id exists and belongs to project."""
        ...

    @abstractmethod
    async def set_artifact_tags(self, artifact_id: uuid.UUID, project_id: uuid.UUID, tag_ids: list[uuid.UUID]) -> None:
        """Replace all tags on artifact (artifact must belong to project)."""
        ...

    @abstractmethod
    async def get_tags_by_artifact_ids(
        self, artifact_ids: list[uuid.UUID]
    ) -> dict[uuid.UUID, tuple[ProjectTagDTO, ...]]:
        """Map artifact_id -> ordered tag DTOs (name ascending)."""
        ...

    @abstractmethod
    async def set_task_tags(self, task_id: uuid.UUID, project_id: uuid.UUID, tag_ids: list[uuid.UUID]) -> None:
        """Replace all tags on task (task must belong to project)."""
        ...

    @abstractmethod
    async def get_tags_by_task_ids(
        self, task_ids: list[uuid.UUID]
    ) -> dict[uuid.UUID, tuple[ProjectTagDTO, ...]]:
        """Map task_id -> ordered tag DTOs (name ascending)."""
        ...

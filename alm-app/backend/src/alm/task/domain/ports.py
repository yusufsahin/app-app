"""Task repository port."""

from __future__ import annotations

import uuid
from abc import abstractmethod

from alm.task.domain.entities import Task


class TaskRepository:
    @abstractmethod
    async def find_by_id(self, task_id: uuid.UUID) -> Task | None: ...

    @abstractmethod
    async def list_by_artifact(
        self,
        artifact_id: uuid.UUID,
        include_deleted: bool = False,
    ) -> list[Task]: ...

    @abstractmethod
    async def count_by_project_ids(self, project_ids: list[uuid.UUID]) -> int:
        """Count non-deleted tasks for the given projects (for dashboard)."""
        ...

    @abstractmethod
    async def add(self, task: Task) -> Task: ...

    @abstractmethod
    async def update(self, task: Task) -> Task: ...

    @abstractmethod
    async def soft_delete(self, task_id: uuid.UUID, deleted_by: uuid.UUID | None = None) -> bool:
        """Soft-delete task. Returns True if found and deleted."""
        ...

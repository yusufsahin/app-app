"""Get single task by id."""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.query import Query, QueryHandler
from alm.task.application.dtos import TaskDTO
from alm.task.domain.ports import TaskRepository


@dataclass(frozen=True)
class GetTask(Query):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    task_id: uuid.UUID


class GetTaskHandler(QueryHandler[TaskDTO | None]):
    def __init__(self, task_repo: TaskRepository) -> None:
        self._task_repo = task_repo

    async def handle(self, query: Query) -> TaskDTO | None:
        assert isinstance(query, GetTask)

        task = await self._task_repo.find_by_id(query.task_id)
        if task is None or task.project_id != query.project_id:
            return None

        return TaskDTO(
            id=task.id,
            project_id=task.project_id,
            artifact_id=task.artifact_id,
            title=task.title,
            state=task.state,
            description=task.description,
            assignee_id=task.assignee_id,
            rank_order=task.rank_order,
            created_at=task.created_at.isoformat() if task.created_at else None,
            updated_at=task.updated_at.isoformat() if task.updated_at else None,
        )

"""List tasks in a project assigned to a user (e.g. "my tasks")."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.query import Query, QueryHandler
from alm.task.application.dtos import TaskDTO
from alm.task.domain.ports import TaskRepository


@dataclass(frozen=True)
class ListTasksByProjectAndAssignee(Query):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    assignee_id: uuid.UUID


class ListTasksByProjectAndAssigneeHandler(QueryHandler[list[TaskDTO]]):
    def __init__(self, task_repo: TaskRepository) -> None:
        self._task_repo = task_repo

    async def handle(self, query: Query) -> list[TaskDTO]:
        assert isinstance(query, ListTasksByProjectAndAssignee)

        tasks = await self._task_repo.list_by_project_and_assignee(
            query.project_id,
            query.assignee_id,
        )
        return [
            TaskDTO(
                id=t.id,
                project_id=t.project_id,
                artifact_id=t.artifact_id,
                title=t.title,
                state=t.state,
                description=t.description,
                assignee_id=t.assignee_id,
                rank_order=t.rank_order,
                created_at=t.created_at.isoformat() if t.created_at else None,
                updated_at=t.updated_at.isoformat() if t.updated_at else None,
            )
            for t in tasks
        ]

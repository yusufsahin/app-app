"""Update task."""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ValidationError
from alm.task.application.dtos import TaskDTO
from alm.task.domain.entities import Task
from alm.task.domain.ports import TaskRepository


@dataclass(frozen=True)
class UpdateTask(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    task_id: uuid.UUID
    title: str | None = None
    state: str | None = None
    description: str | None = None
    assignee_id: uuid.UUID | None = None
    rank_order: float | None = None


class UpdateTaskHandler(CommandHandler[TaskDTO]):
    def __init__(self, task_repo: TaskRepository) -> None:
        self._task_repo = task_repo

    async def handle(self, command: Command) -> TaskDTO:
        assert isinstance(command, UpdateTask)

        task = await self._task_repo.find_by_id(command.task_id)
        if task is None or task.project_id != command.project_id:
            raise ValidationError("Task not found")

        if command.title is not None:
            task.title = command.title.strip() or task.title
        if command.state is not None:
            task.state = command.state.strip() or task.state
        if command.description is not None:
            task.description = command.description
        if command.assignee_id is not None:
            task.assignee_id = command.assignee_id
        if command.rank_order is not None:
            task.rank_order = command.rank_order

        await self._task_repo.update(task)

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

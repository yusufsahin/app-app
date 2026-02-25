"""Soft-delete task."""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ValidationError
from alm.task.domain.ports import TaskRepository


@dataclass(frozen=True)
class DeleteTask(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    task_id: uuid.UUID
    deleted_by: uuid.UUID | None = None


class DeleteTaskHandler(CommandHandler[bool]):
    def __init__(self, task_repo: TaskRepository) -> None:
        self._task_repo = task_repo

    async def handle(self, command: Command) -> bool:
        assert isinstance(command, DeleteTask)

        task = await self._task_repo.find_by_id(command.task_id)
        if task is None or task.project_id != command.project_id:
            raise ValidationError("Task not found")

        return await self._task_repo.soft_delete(
            command.task_id,
            deleted_by=command.deleted_by,
        )

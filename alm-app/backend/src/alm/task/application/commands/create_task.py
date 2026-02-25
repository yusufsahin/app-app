"""Create task linked to an artifact."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.artifact.domain.ports import ArtifactRepository
from alm.project.domain.ports import ProjectRepository
from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ValidationError
from alm.task.application.dtos import TaskDTO
from alm.task.domain.entities import Task
from alm.task.domain.ports import TaskRepository


@dataclass(frozen=True)
class CreateTask(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    artifact_id: uuid.UUID
    title: str
    description: str = ""
    state: str = "todo"
    assignee_id: uuid.UUID | None = None
    rank_order: float | None = None


class CreateTaskHandler(CommandHandler[TaskDTO]):
    def __init__(
        self,
        task_repo: TaskRepository,
        artifact_repo: ArtifactRepository,
        project_repo: ProjectRepository,
    ) -> None:
        self._task_repo = task_repo
        self._artifact_repo = artifact_repo
        self._project_repo = project_repo

    async def handle(self, command: Command) -> TaskDTO:
        assert isinstance(command, CreateTask)

        project = await self._project_repo.find_by_id(command.project_id)
        if project is None or project.tenant_id != command.tenant_id:
            raise ValidationError("Project not found")

        artifact = await self._artifact_repo.find_by_id(command.artifact_id)
        if artifact is None or artifact.project_id != command.project_id:
            raise ValidationError("Artifact not found")

        task = Task.create(
            project_id=command.project_id,
            artifact_id=command.artifact_id,
            title=command.title.strip() or "Untitled task",
            state=command.state or "todo",
            description=command.description or "",
            assignee_id=command.assignee_id,
            rank_order=command.rank_order,
        )
        await self._task_repo.add(task)

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

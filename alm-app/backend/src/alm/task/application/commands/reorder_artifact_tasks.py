"""Persist task order for an artifact (rank_order)."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.artifact.domain.ports import ArtifactRepository
from alm.project.domain.ports import ProjectRepository
from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ValidationError
from alm.task.domain.ports import TaskRepository


@dataclass(frozen=True)
class ReorderArtifactTasks(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    artifact_id: uuid.UUID
    ordered_task_ids: tuple[uuid.UUID, ...]


class ReorderArtifactTasksHandler(CommandHandler[None]):
    def __init__(
        self,
        task_repo: TaskRepository,
        artifact_repo: ArtifactRepository,
        project_repo: ProjectRepository,
    ) -> None:
        self._task_repo = task_repo
        self._artifact_repo = artifact_repo
        self._project_repo = project_repo

    async def handle(self, command: Command) -> None:
        assert isinstance(command, ReorderArtifactTasks)

        project = await self._project_repo.find_by_id(command.project_id)
        if project is None or project.tenant_id != command.tenant_id:
            raise ValidationError("Project not found")

        artifact = await self._artifact_repo.find_by_id(command.artifact_id)
        if artifact is None or artifact.project_id != command.project_id:
            raise ValidationError("Artifact not found")

        current = await self._task_repo.list_by_artifact(command.artifact_id)
        current_ids = {t.id for t in current}
        ordered = list(command.ordered_task_ids)
        if len(ordered) != len(current_ids) or set(ordered) != current_ids:
            raise ValidationError("Task order must include exactly this artifact's tasks")

        for rank, task_id in enumerate(ordered):
            task = next((t for t in current if t.id == task_id), None)
            if task is None:
                raise ValidationError("Task not found")
            task.rank_order = float(rank)
            await self._task_repo.update(task)

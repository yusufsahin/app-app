"""Update task."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any

from alm.artifact.domain.manifest_workflow_metadata import allowed_task_state_ids
from alm.process_template.domain.ports import ProcessTemplateRepository
from alm.project.domain.ports import ProjectRepository
from alm.project_tag.domain.ports import ProjectTagRepository
from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ValidationError
from alm.task.application.dtos import TaskDTO
from alm.task.domain.ports import TaskRepository

_TAG_IDS_OMITTED = object()


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
    team_id: uuid.UUID | None = None
    tag_ids: Any = _TAG_IDS_OMITTED


class UpdateTaskHandler(CommandHandler[TaskDTO]):
    def __init__(
        self,
        task_repo: TaskRepository,
        project_repo: ProjectRepository,
        process_template_repo: ProcessTemplateRepository,
        tag_repo: ProjectTagRepository,
    ) -> None:
        self._task_repo = task_repo
        self._project_repo = project_repo
        self._process_template_repo = process_template_repo
        self._tag_repo = tag_repo

    async def handle(self, command: Command) -> TaskDTO:
        assert isinstance(command, UpdateTask)

        task = await self._task_repo.find_by_id(command.task_id)
        if task is None or task.project_id != command.project_id:
            raise ValidationError("Task not found")

        if command.title is not None:
            task.title = command.title.strip() or task.title
        if command.state is not None:
            new_s = command.state.strip()
            if new_s:
                project = await self._project_repo.find_by_id(command.project_id)
                if project is None or project.tenant_id != command.tenant_id:
                    raise ValidationError("Project not found")
                manifest: dict[str, Any] = {}
                if project.process_template_version_id:
                    version = await self._process_template_repo.find_version_by_id(project.process_template_version_id)
                    if version and version.manifest_bundle:
                        manifest = version.manifest_bundle
                if new_s not in allowed_task_state_ids(manifest):
                    raise ValidationError(f"Invalid task state '{new_s}' for this project's manifest")
                task.state = new_s
        if command.description is not None:
            task.description = command.description
        if command.assignee_id is not None:
            task.assignee_id = command.assignee_id
        if command.rank_order is not None:
            task.rank_order = command.rank_order
        if command.team_id is not None:
            task.team_id = command.team_id

        if command.tag_ids is not _TAG_IDS_OMITTED:
            raw = command.tag_ids
            if raw is None:
                tid_list: list[uuid.UUID] = []
            elif not isinstance(raw, list):
                raise ValidationError("tag_ids must be a list of UUID strings")
            else:
                tid_list = [uuid.UUID(str(x).strip()) for x in raw]
            try:
                await self._tag_repo.set_task_tags(task.id, command.project_id, tid_list)
            except ValueError as e:
                raise ValidationError(str(e)) from e

        await self._task_repo.update(task)

        tag_map = await self._tag_repo.get_tags_by_task_ids([task.id])
        tags = tag_map.get(task.id, ())

        return TaskDTO(
            id=task.id,
            project_id=task.project_id,
            artifact_id=task.artifact_id,
            title=task.title,
            state=task.state,
            description=task.description,
            assignee_id=task.assignee_id,
            rank_order=task.rank_order,
            team_id=task.team_id,
            created_at=task.created_at.isoformat() if task.created_at else None,
            updated_at=task.updated_at.isoformat() if task.updated_at else None,
            tags=tags,
        )

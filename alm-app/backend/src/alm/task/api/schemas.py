"""Task API schemas."""

from __future__ import annotations

import uuid

from pydantic import BaseModel, Field

from alm.task.application.dtos import TaskDTO


class ProjectTagBrief(BaseModel):
    id: uuid.UUID
    name: str


class TaskCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    description: str = ""
    state: str = "todo"
    assignee_id: uuid.UUID | None = None
    rank_order: float | None = None
    team_id: uuid.UUID | None = None
    tag_ids: list[uuid.UUID] | None = None


class TaskUpdateRequest(BaseModel):
    title: str | None = Field(None, max_length=500)
    state: str | None = None
    description: str | None = None
    assignee_id: uuid.UUID | None = None
    rank_order: float | None = None
    team_id: uuid.UUID | None = None
    tag_ids: list[uuid.UUID] | None = None


class TaskResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    artifact_id: uuid.UUID
    title: str
    state: str
    description: str
    assignee_id: uuid.UUID | None
    rank_order: float | None
    team_id: uuid.UUID | None = None
    created_at: str | None
    updated_at: str | None
    tags: list[ProjectTagBrief] = Field(default_factory=list)


def task_response_from_dto(d: TaskDTO) -> TaskResponse:
    return TaskResponse(
        id=d.id,
        project_id=d.project_id,
        artifact_id=d.artifact_id,
        title=d.title,
        state=d.state,
        description=d.description,
        assignee_id=d.assignee_id,
        rank_order=d.rank_order,
        team_id=d.team_id,
        created_at=d.created_at,
        updated_at=d.updated_at,
        tags=[ProjectTagBrief(id=t.id, name=t.name) for t in d.tags],
    )

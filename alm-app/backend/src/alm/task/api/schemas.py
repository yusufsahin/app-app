"""Task API schemas."""

from __future__ import annotations

import uuid

from pydantic import BaseModel, Field, field_validator

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
    original_estimate_hours: float | None = Field(default=None, ge=0)
    remaining_work_hours: float | None = Field(default=None, ge=0)
    activity: str | None = None
    tag_ids: list[uuid.UUID] | None = None

    @field_validator("activity", mode="before")
    @classmethod
    def _create_empty_activity_to_none(cls, v: object) -> object:
        if v == "":
            return None
        return v


class TaskUpdateRequest(BaseModel):
    title: str | None = Field(None, max_length=500)
    state: str | None = None
    description: str | None = None
    assignee_id: uuid.UUID | None = None
    rank_order: float | None = None
    team_id: uuid.UUID | None = None
    original_estimate_hours: float | None = Field(default=None, ge=0)
    remaining_work_hours: float | None = Field(default=None, ge=0)
    activity: str | None = None
    tag_ids: list[uuid.UUID] | None = None

    @field_validator("activity", mode="before")
    @classmethod
    def _empty_activity_to_none(cls, v: object) -> object:
        if v == "":
            return None
        return v


class TaskReorderRequest(BaseModel):
    ordered_task_ids: list[uuid.UUID]


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
    original_estimate_hours: float | None = None
    remaining_work_hours: float | None = None
    activity: str | None = None
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
        original_estimate_hours=d.original_estimate_hours,
        remaining_work_hours=d.remaining_work_hours,
        activity=d.activity,
        created_at=d.created_at,
        updated_at=d.updated_at,
        tags=[ProjectTagBrief(id=t.id, name=t.name) for t in d.tags],
    )

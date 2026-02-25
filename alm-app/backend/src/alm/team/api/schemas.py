"""Team API schemas (P6)."""

from __future__ import annotations

import uuid

from pydantic import BaseModel, Field


class TeamMemberResponse(BaseModel):
    team_id: uuid.UUID
    user_id: uuid.UUID
    role: str


class TeamCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str = ""


class TeamUpdateRequest(BaseModel):
    name: str | None = Field(None, max_length=255)
    description: str | None = None


class TeamResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    description: str
    created_at: str | None
    updated_at: str | None
    members: list[TeamMemberResponse] = []


class AddTeamMemberRequest(BaseModel):
    user_id: uuid.UUID
    role: str = "member"

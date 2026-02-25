from __future__ import annotations

import uuid
from typing import Any

from pydantic import BaseModel


class ProjectCreateRequest(BaseModel):
    code: str
    name: str
    description: str = ""
    process_template_slug: str | None = None  # basic, scrum, kanban; default: basic


class ProjectResponse(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    slug: str
    description: str
    status: str | None = None
    settings: dict[str, Any] | None = None
    metadata: dict[str, Any] | None = None


class UpdateProjectRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    status: str | None = None
    settings: dict[str, Any] | None = None
    metadata: dict[str, Any] | None = None


class UpdateProjectManifestRequest(BaseModel):
    manifest_bundle: dict[str, Any]


class AddProjectMemberRequest(BaseModel):
    user_id: uuid.UUID
    role: str = "PROJECT_VIEWER"


class UpdateProjectMemberRequest(BaseModel):
    role: str


class ProjectMemberResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    user_id: uuid.UUID
    role: str

from __future__ import annotations

import uuid

from pydantic import BaseModel


class ProjectCreateRequest(BaseModel):
    code: str
    name: str
    description: str = ""


class ProjectResponse(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    slug: str
    description: str

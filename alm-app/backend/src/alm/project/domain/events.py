from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.domain.events import DomainEvent


@dataclass(frozen=True, kw_only=True)
class ProjectCreated(DomainEvent):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    name: str
    slug: str
    code: str

"""Process template domain entities."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any


@dataclass
class ProcessTemplate:
    """Built-in process template (Basic, Scrum, Kanban, etc.)."""

    id: uuid.UUID
    slug: str
    name: str
    is_builtin: bool
    description: str | None = None
    type: str | None = None
    configuration: dict[str, Any] | None = None


@dataclass
class ProcessTemplateVersion:
    """A version of a process template with manifest bundle."""

    id: uuid.UUID
    template_id: uuid.UUID
    version: str
    manifest_bundle: dict[str, Any]

"""Process template repository port."""
from __future__ import annotations

import uuid
from abc import abstractmethod

from alm.process_template.domain.entities import ProcessTemplate, ProcessTemplateVersion


class ProcessTemplateRepository:
    """Port for process template persistence."""

    @abstractmethod
    async def find_all(self) -> list[ProcessTemplate]:
        """List all process templates (built-in catalog)."""
        ...

    @abstractmethod
    async def find_by_id(self, template_id: uuid.UUID) -> ProcessTemplate | None:
        """Get a process template by ID."""
        ...

    @abstractmethod
    async def find_version_by_id(
        self, version_id: uuid.UUID
    ) -> ProcessTemplateVersion | None:
        """Get a process template version by ID."""
        ...

    @abstractmethod
    async def find_default_version(self) -> ProcessTemplateVersion | None:
        """Get the default (Basic) template version, if any."""
        ...

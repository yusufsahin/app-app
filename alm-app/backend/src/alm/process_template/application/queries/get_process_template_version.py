"""Get process template version query."""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.query import Query, QueryHandler
from alm.process_template.domain.entities import ProcessTemplateVersion
from alm.process_template.domain.ports import ProcessTemplateRepository


@dataclass(frozen=True)
class GetProcessTemplateVersion(Query):
    """Get a process template version by ID."""

    version_id: uuid.UUID


class GetProcessTemplateVersionHandler(QueryHandler[ProcessTemplateVersion | None]):
    def __init__(self, repo: ProcessTemplateRepository) -> None:
        self._repo = repo

    async def handle(self, query: Query) -> ProcessTemplateVersion | None:
        assert isinstance(query, GetProcessTemplateVersion)
        return await self._repo.find_version_by_id(query.version_id)

"""Get process template query."""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.query import Query, QueryHandler
from alm.process_template.domain.entities import ProcessTemplate
from alm.process_template.domain.ports import ProcessTemplateRepository


@dataclass(frozen=True)
class GetProcessTemplate(Query):
    """Get a process template by ID."""

    template_id: uuid.UUID


class GetProcessTemplateHandler(QueryHandler[ProcessTemplate | None]):
    def __init__(self, repo: ProcessTemplateRepository) -> None:
        self._repo = repo

    async def handle(self, query: Query) -> ProcessTemplate | None:
        assert isinstance(query, GetProcessTemplate)
        return await self._repo.find_by_id(query.template_id)

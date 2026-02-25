"""List process templates query."""

from __future__ import annotations

from dataclasses import dataclass

from alm.process_template.domain.entities import ProcessTemplate
from alm.process_template.domain.ports import ProcessTemplateRepository
from alm.shared.application.query import Query, QueryHandler


@dataclass(frozen=True)
class ListProcessTemplates(Query):
    """List all available process templates (global catalog)."""

    pass


class ListProcessTemplatesHandler(QueryHandler[list[ProcessTemplate]]):
    def __init__(self, repo: ProcessTemplateRepository) -> None:
        self._repo = repo

    async def handle(self, query: Query) -> list[ProcessTemplate]:
        assert isinstance(query, ListProcessTemplates)
        return await self._repo.find_all()

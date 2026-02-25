"""Delete saved query."""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ValidationError
from alm.saved_query.domain.ports import SavedQueryRepository


@dataclass(frozen=True)
class DeleteSavedQuery(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    query_id: uuid.UUID


class DeleteSavedQueryHandler(CommandHandler[bool]):
    def __init__(self, saved_query_repo: SavedQueryRepository) -> None:
        self._saved_query_repo = saved_query_repo

    async def handle(self, command: Command) -> bool:
        assert isinstance(command, DeleteSavedQuery)

        saved = await self._saved_query_repo.find_by_id(command.query_id)
        if saved is None or saved.project_id != command.project_id:
            raise ValidationError("Saved query not found")

        return await self._saved_query_repo.delete(command.query_id)

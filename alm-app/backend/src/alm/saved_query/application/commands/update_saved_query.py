"""Update saved query."""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ValidationError
from alm.saved_query.application.dtos import SavedQueryDTO
from alm.saved_query.domain.entities import SavedQuery
from alm.saved_query.domain.ports import SavedQueryRepository


@dataclass(frozen=True)
class UpdateSavedQuery(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    query_id: uuid.UUID
    name: str | None = None
    visibility: str | None = None
    filter_params: dict | None = None


class UpdateSavedQueryHandler(CommandHandler[SavedQueryDTO]):
    def __init__(self, saved_query_repo: SavedQueryRepository) -> None:
        self._saved_query_repo = saved_query_repo

    async def handle(self, command: Command) -> SavedQueryDTO:
        assert isinstance(command, UpdateSavedQuery)

        saved = await self._saved_query_repo.find_by_id(command.query_id)
        if saved is None or saved.project_id != command.project_id:
            raise ValidationError("Saved query not found")

        name = saved.name
        if command.name is not None:
            n = command.name.strip()
            if n:
                name = n
        visibility = saved.visibility
        if command.visibility is not None:
            vis = command.visibility.strip().lower()
            if vis in ("private", "project"):
                visibility = vis
        filter_params = saved.filter_params
        if command.filter_params is not None:
            filter_params = command.filter_params

        updated_entity = SavedQuery(
            id=saved.id,
            project_id=saved.project_id,
            name=name,
            owner_id=saved.owner_id,
            visibility=visibility,
            filter_params=filter_params,
            created_at=saved.created_at,
            updated_at=saved.updated_at,
        )
        await self._saved_query_repo.update(updated_entity)

        u = await self._saved_query_repo.find_by_id(command.query_id) or updated_entity
        return SavedQueryDTO(
            id=u.id,
            project_id=u.project_id,
            name=u.name,
            owner_id=u.owner_id,
            visibility=u.visibility,
            filter_params=u.filter_params,
            created_at=u.created_at.isoformat() if u.created_at else None,
            updated_at=u.updated_at.isoformat() if u.updated_at else None,
        )

"""Create saved query."""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ValidationError
from alm.saved_query.application.dtos import SavedQueryDTO
from alm.saved_query.domain.entities import SavedQuery
from alm.saved_query.domain.ports import SavedQueryRepository
from alm.project.domain.ports import ProjectRepository


@dataclass(frozen=True)
class CreateSavedQuery(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    name: str
    owner_id: uuid.UUID
    filter_params: dict
    visibility: str = "private"


class CreateSavedQueryHandler(CommandHandler[SavedQueryDTO]):
    def __init__(
        self,
        saved_query_repo: SavedQueryRepository,
        project_repo: ProjectRepository,
    ) -> None:
        self._saved_query_repo = saved_query_repo
        self._project_repo = project_repo

    async def handle(self, command: Command) -> SavedQueryDTO:
        assert isinstance(command, CreateSavedQuery)

        project = await self._project_repo.find_by_id(command.project_id)
        if project is None or project.tenant_id != command.tenant_id:
            raise ValidationError("Project not found")

        name = (command.name or "").strip()
        if not name:
            raise ValidationError("Name is required")

        visibility = (command.visibility or "private").strip().lower()
        if visibility not in ("private", "project"):
            visibility = "private"

        saved_query = SavedQuery.create(
            project_id=command.project_id,
            name=name,
            owner_id=command.owner_id,
            filter_params=command.filter_params or {},
            visibility=visibility,
        )
        await self._saved_query_repo.add(saved_query)

        return SavedQueryDTO(
            id=saved_query.id,
            project_id=saved_query.project_id,
            name=saved_query.name,
            owner_id=saved_query.owner_id,
            visibility=saved_query.visibility,
            filter_params=saved_query.filter_params,
            created_at=saved_query.created_at.isoformat() if saved_query.created_at else None,
            updated_at=saved_query.updated_at.isoformat() if saved_query.updated_at else None,
        )

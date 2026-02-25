"""Delete team (P6)."""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ValidationError
from alm.team.domain.ports import TeamRepository
from alm.project.domain.ports import ProjectRepository


@dataclass(frozen=True)
class DeleteTeam(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    team_id: uuid.UUID


class DeleteTeamHandler(CommandHandler[None]):
    def __init__(
        self,
        team_repo: TeamRepository,
        project_repo: ProjectRepository,
    ) -> None:
        self._team_repo = team_repo
        self._project_repo = project_repo

    async def handle(self, command: Command) -> None:
        assert isinstance(command, DeleteTeam)

        project = await self._project_repo.find_by_id(command.project_id)
        if project is None or project.tenant_id != command.tenant_id:
            raise ValidationError("Project not found")

        team = await self._team_repo.find_by_id(command.team_id)
        if team is None or team.project_id != command.project_id:
            raise ValidationError("Team not found")

        await self._team_repo.delete(command.team_id)

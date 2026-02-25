"""Update team (P6)."""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ValidationError
from alm.team.application.dtos import TeamDTO, TeamMemberDTO
from alm.team.domain.ports import TeamRepository
from alm.project.domain.ports import ProjectRepository


@dataclass(frozen=True)
class UpdateTeam(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    team_id: uuid.UUID
    name: str | None = None
    description: str | None = None


class UpdateTeamHandler(CommandHandler[TeamDTO]):
    def __init__(
        self,
        team_repo: TeamRepository,
        project_repo: ProjectRepository,
    ) -> None:
        self._team_repo = team_repo
        self._project_repo = project_repo

    async def handle(self, command: Command) -> TeamDTO:
        assert isinstance(command, UpdateTeam)

        project = await self._project_repo.find_by_id(command.project_id)
        if project is None or project.tenant_id != command.tenant_id:
            raise ValidationError("Project not found")

        team = await self._team_repo.find_by_id(command.team_id)
        if team is None or team.project_id != command.project_id:
            raise ValidationError("Team not found")

        if command.name is not None:
            name_trim = (command.name or "").strip()
            if not name_trim:
                raise ValidationError("Team name cannot be empty")
            team.update(name=name_trim)
        if command.description is not None:
            team.update(description=command.description)

        await self._team_repo.update(team)
        members = await self._team_repo.list_members(team.id)

        return TeamDTO(
            id=team.id,
            project_id=team.project_id,
            name=team.name,
            description=team.description,
            created_at=team.created_at.isoformat() if team.created_at else None,
            updated_at=team.updated_at.isoformat() if team.updated_at else None,
            members=[
                TeamMemberDTO(team_id=m.team_id, user_id=m.user_id, role=m.role)
                for m in members
            ],
        )

"""Add member to team (P6)."""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ValidationError
from alm.team.application.dtos import TeamDTO, TeamMemberDTO
from alm.team.domain.entities import TeamMember
from alm.team.domain.ports import TeamRepository
from alm.project.domain.ports import ProjectRepository


@dataclass(frozen=True)
class AddTeamMember(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    team_id: uuid.UUID
    user_id: uuid.UUID
    role: str = "member"


class AddTeamMemberHandler(CommandHandler[TeamDTO]):
    def __init__(
        self,
        team_repo: TeamRepository,
        project_repo: ProjectRepository,
    ) -> None:
        self._team_repo = team_repo
        self._project_repo = project_repo

    async def handle(self, command: Command) -> TeamDTO:
        assert isinstance(command, AddTeamMember)

        project = await self._project_repo.find_by_id(command.project_id)
        if project is None or project.tenant_id != command.tenant_id:
            raise ValidationError("Project not found")

        team = await self._team_repo.find_by_id(command.team_id)
        if team is None or team.project_id != command.project_id:
            raise ValidationError("Team not found")

        member = TeamMember(
            team_id=command.team_id,
            user_id=command.user_id,
            role=command.role or "member",
        )
        await self._team_repo.add_member(member)

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

"""Get team by id (P6)."""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.query import Query, QueryHandler
from alm.team.application.dtos import TeamDTO, TeamMemberDTO
from alm.team.domain.ports import TeamRepository
from alm.project.domain.ports import ProjectRepository


@dataclass(frozen=True)
class GetTeam(Query):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    team_id: uuid.UUID


class GetTeamHandler(QueryHandler[TeamDTO | None]):
    def __init__(
        self,
        team_repo: TeamRepository,
        project_repo: ProjectRepository,
    ) -> None:
        self._team_repo = team_repo
        self._project_repo = project_repo

    async def handle(self, query: Query) -> TeamDTO | None:
        assert isinstance(query, GetTeam)

        project = await self._project_repo.find_by_id(query.project_id)
        if project is None or project.tenant_id != query.tenant_id:
            return None

        team = await self._team_repo.find_by_id(query.team_id)
        if team is None or team.project_id != query.project_id:
            return None

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

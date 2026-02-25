"""Team SQLAlchemy repository (P6)."""

from __future__ import annotations

import uuid

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from alm.team.domain.entities import Team, TeamMember
from alm.team.domain.ports import TeamRepository
from alm.team.infrastructure.models import TeamMemberModel, TeamModel


class SqlAlchemyTeamRepository(TeamRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def find_by_id(self, team_id: uuid.UUID) -> Team | None:
        result = await self._session.execute(select(TeamModel).where(TeamModel.id == team_id))
        model = result.scalar_one_or_none()
        return self._to_team_entity(model) if model else None

    async def list_by_project(self, project_id: uuid.UUID) -> list[Team]:
        result = await self._session.execute(
            select(TeamModel).where(TeamModel.project_id == project_id).order_by(TeamModel.name.asc())
        )
        return [self._to_team_entity(m) for m in result.scalars().all()]

    async def add(self, team: Team) -> Team:
        model = TeamModel(
            id=team.id,
            project_id=team.project_id,
            name=team.name,
            description=team.description or "",
        )
        self._session.add(model)
        await self._session.flush()
        return team

    async def update(self, team: Team) -> Team:
        await self._session.execute(
            update(TeamModel).where(TeamModel.id == team.id).values(name=team.name, description=team.description or "")
        )
        await self._session.flush()
        return team

    async def delete(self, team_id: uuid.UUID) -> bool:
        result = await self._session.execute(delete(TeamModel).where(TeamModel.id == team_id))
        await self._session.flush()
        return bool(getattr(result, "rowcount", 0))

    async def list_members(self, team_id: uuid.UUID) -> list[TeamMember]:
        result = await self._session.execute(select(TeamMemberModel).where(TeamMemberModel.team_id == team_id))
        return [self._to_member_entity(m) for m in result.scalars().all()]

    async def add_member(self, member: TeamMember) -> None:
        model = TeamMemberModel(
            team_id=member.team_id,
            user_id=member.user_id,
            role=member.role,
        )
        self._session.add(model)
        await self._session.flush()

    async def remove_member(self, team_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        result = await self._session.execute(
            delete(TeamMemberModel).where(
                TeamMemberModel.team_id == team_id,
                TeamMemberModel.user_id == user_id,
            )
        )
        await self._session.flush()
        return bool(getattr(result, "rowcount", 0))

    @staticmethod
    def _to_team_entity(m: TeamModel) -> Team:
        return Team(
            id=m.id,
            project_id=m.project_id,
            name=m.name,
            description=m.description or "",
            created_at=m.created_at,
            updated_at=m.updated_at,
        )

    @staticmethod
    def _to_member_entity(m: TeamMemberModel) -> TeamMember:
        return TeamMember(team_id=m.team_id, user_id=m.user_id, role=m.role)

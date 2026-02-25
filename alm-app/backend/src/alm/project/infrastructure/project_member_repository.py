"""ProjectMember SQLAlchemy repository."""
from __future__ import annotations

import uuid

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from alm.project.domain.ports import ProjectMemberRepository
from alm.project.domain.project_member import ProjectMember
from alm.project.infrastructure.project_member_models import ProjectMemberModel


class SqlAlchemyProjectMemberRepository(ProjectMemberRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, member: ProjectMember) -> ProjectMember:
        model = ProjectMemberModel(
            id=member.id,
            project_id=member.project_id,
            user_id=member.user_id,
            role=member.role,
        )
        self._session.add(model)
        await self._session.flush()
        return member

    async def find_by_project_and_user(
        self, project_id: uuid.UUID, user_id: uuid.UUID
    ) -> ProjectMember | None:
        result = await self._session.execute(
            select(ProjectMemberModel).where(
                ProjectMemberModel.project_id == project_id,
                ProjectMemberModel.user_id == user_id,
            )
        )
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def list_by_project(self, project_id: uuid.UUID) -> list[ProjectMember]:
        result = await self._session.execute(
            select(ProjectMemberModel).where(
                ProjectMemberModel.project_id == project_id
            )
        )
        return [self._to_entity(m) for m in result.scalars().all()]

    async def delete_by_project_and_user(
        self, project_id: uuid.UUID, user_id: uuid.UUID
    ) -> bool:
        result = await self._session.execute(
            delete(ProjectMemberModel).where(
                ProjectMemberModel.project_id == project_id,
                ProjectMemberModel.user_id == user_id,
            )
        )
        return result.rowcount > 0

    async def update(self, member: ProjectMember) -> ProjectMember:
        await self._session.execute(
            update(ProjectMemberModel)
            .where(ProjectMemberModel.id == member.id)
            .values(role=member.role)
        )
        await self._session.flush()
        return member

    @staticmethod
    def _to_entity(m: ProjectMemberModel) -> ProjectMember:
        return ProjectMember(
            id=m.id,
            project_id=m.project_id,
            user_id=m.user_id,
            role=m.role,
        )

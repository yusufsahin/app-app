"""SavedQuery SQLAlchemy repository."""

from __future__ import annotations

import uuid

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from alm.saved_query.domain.entities import SavedQuery
from alm.saved_query.domain.ports import SavedQueryRepository
from alm.saved_query.infrastructure.models import SavedQueryModel


class SqlAlchemySavedQueryRepository(SavedQueryRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def find_by_id(self, query_id: uuid.UUID) -> SavedQuery | None:
        result = await self._session.execute(select(SavedQueryModel).where(SavedQueryModel.id == query_id))
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def list_by_project(
        self,
        project_id: uuid.UUID,
        *,
        include_private_for_user: uuid.UUID | None = None,
    ) -> list[SavedQuery]:
        q = select(SavedQueryModel).where(SavedQueryModel.project_id == project_id)
        if include_private_for_user is not None:
            q = q.where(
                or_(
                    SavedQueryModel.visibility == "project",
                    SavedQueryModel.owner_id == include_private_for_user,
                )
            )
        else:
            q = q.where(SavedQueryModel.visibility == "project")
        q = q.order_by(SavedQueryModel.updated_at.desc().nullslast(), SavedQueryModel.created_at.desc())
        result = await self._session.execute(q)
        return [self._to_entity(m) for m in result.scalars().all()]

    async def add(self, saved_query: SavedQuery) -> SavedQuery:
        model = SavedQueryModel(
            id=saved_query.id,
            project_id=saved_query.project_id,
            name=saved_query.name,
            owner_id=saved_query.owner_id,
            visibility=saved_query.visibility,
            filter_params=saved_query.filter_params,
        )
        self._session.add(model)
        await self._session.flush()
        return saved_query

    async def update(self, saved_query: SavedQuery) -> SavedQuery:
        from sqlalchemy import update

        await self._session.execute(
            update(SavedQueryModel)
            .where(SavedQueryModel.id == saved_query.id)
            .values(
                name=saved_query.name,
                visibility=saved_query.visibility,
                filter_params=saved_query.filter_params,
            )
        )
        await self._session.flush()
        return saved_query

    async def delete(self, query_id: uuid.UUID) -> bool:
        result = await self._session.execute(select(SavedQueryModel).where(SavedQueryModel.id == query_id))
        model = result.scalar_one_or_none()
        if model is None:
            return False
        await self._session.delete(model)
        await self._session.flush()
        return True

    @staticmethod
    def _to_entity(m: SavedQueryModel) -> SavedQuery:
        return SavedQuery(
            id=m.id,
            project_id=m.project_id,
            name=m.name,
            owner_id=m.owner_id,
            visibility=m.visibility,
            filter_params=m.filter_params or {},
            created_at=m.created_at,
            updated_at=m.updated_at,
        )

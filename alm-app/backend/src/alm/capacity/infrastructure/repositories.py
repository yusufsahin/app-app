"""Capacity SQLAlchemy repository."""

from __future__ import annotations

import uuid

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from alm.capacity.domain.entities import Capacity
from alm.capacity.domain.ports import CapacityRepository
from alm.capacity.infrastructure.models import CapacityModel


class SqlAlchemyCapacityRepository(CapacityRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def find_by_id(self, capacity_id: uuid.UUID) -> Capacity | None:
        result = await self._session.execute(select(CapacityModel).where(CapacityModel.id == capacity_id))
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def list_by_project(
        self,
        project_id: uuid.UUID,
        cycle_id: uuid.UUID | None = None,
        team_id: uuid.UUID | None = None,
        user_id: uuid.UUID | None = None,
    ) -> list[Capacity]:
        q = select(CapacityModel).where(CapacityModel.project_id == project_id)
        if cycle_id is not None:
            q = q.where(CapacityModel.cycle_id == cycle_id)
        if team_id is not None:
            q = q.where(CapacityModel.team_id == team_id)
        if user_id is not None:
            q = q.where(CapacityModel.user_id == user_id)
        q = q.order_by(CapacityModel.updated_at.desc().nullslast())
        result = await self._session.execute(q)
        return [self._to_entity(m) for m in result.scalars().all()]

    async def add(self, capacity: Capacity) -> Capacity:
        model = CapacityModel(
            id=capacity.id,
            project_id=capacity.project_id,
            cycle_id=capacity.cycle_id,
            team_id=capacity.team_id,
            user_id=capacity.user_id,
            capacity_value=capacity.capacity_value,
            unit=capacity.unit,
        )
        self._session.add(model)
        await self._session.flush()
        await self._session.refresh(model)
        capacity.created_at = model.created_at
        capacity.updated_at = model.updated_at
        return capacity

    async def update(self, capacity: Capacity) -> Capacity:
        await self._session.execute(
            update(CapacityModel)
            .where(CapacityModel.id == capacity.id)
            .values(
                cycle_id=capacity.cycle_id,
                team_id=capacity.team_id,
                user_id=capacity.user_id,
                capacity_value=capacity.capacity_value,
                unit=capacity.unit,
            )
        )
        await self._session.flush()
        refreshed = await self.find_by_id(capacity.id)
        if refreshed is not None:
            capacity.created_at = refreshed.created_at
            capacity.updated_at = refreshed.updated_at
        return capacity

    async def delete(self, capacity_id: uuid.UUID) -> bool:
        result = await self._session.execute(delete(CapacityModel).where(CapacityModel.id == capacity_id))
        await self._session.flush()
        return bool(getattr(result, "rowcount", 0))

    @staticmethod
    def _to_entity(m: CapacityModel) -> Capacity:
        return Capacity(
            id=m.id,
            project_id=m.project_id,
            cycle_id=m.cycle_id,
            team_id=m.team_id,
            user_id=m.user_id,
            capacity_value=m.capacity_value,
            unit=m.unit,
            created_at=m.created_at,
            updated_at=m.updated_at,
        )


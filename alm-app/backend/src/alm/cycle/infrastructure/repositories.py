"""CycleNode SQLAlchemy repository."""
from __future__ import annotations

import uuid

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from alm.cycle.domain.entities import CycleNode
from alm.cycle.domain.ports import CycleRepository
from alm.cycle.infrastructure.models import CycleNodeModel


class SqlAlchemyCycleRepository(CycleRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def find_by_id(self, cycle_node_id: uuid.UUID) -> CycleNode | None:
        result = await self._session.execute(
            select(CycleNodeModel).where(CycleNodeModel.id == cycle_node_id)
        )
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def list_by_project(self, project_id: uuid.UUID) -> list[CycleNode]:
        result = await self._session.execute(
            select(CycleNodeModel)
            .where(CycleNodeModel.project_id == project_id)
            .order_by(CycleNodeModel.path.asc())
        )
        return [self._to_entity(m) for m in result.scalars().all()]

    async def add(self, node: CycleNode) -> CycleNode:
        model = CycleNodeModel(
            id=node.id,
            project_id=node.project_id,
            name=node.name,
            parent_id=node.parent_id,
            path=node.path,
            start_date=node.start_date,
            end_date=node.end_date,
            depth=node.depth,
            sort_order=node.sort_order,
            goal=node.goal or "",
            state=node.state or "planned",
        )
        self._session.add(model)
        await self._session.flush()
        return node

    async def update(self, node: CycleNode) -> CycleNode:
        await self._session.execute(
            update(CycleNodeModel)
            .where(CycleNodeModel.id == node.id)
            .values(
                name=node.name,
                path=node.path,
                goal=node.goal or "",
                start_date=node.start_date,
                end_date=node.end_date,
                state=node.state or "planned",
                sort_order=node.sort_order,
            )
        )
        await self._session.flush()
        return node

    async def delete(self, cycle_node_id: uuid.UUID) -> bool:
        result = await self._session.execute(
            delete(CycleNodeModel).where(CycleNodeModel.id == cycle_node_id)
        )
        await self._session.flush()
        return result.rowcount > 0

    @staticmethod
    def _to_entity(m: CycleNodeModel) -> CycleNode:
        return CycleNode(
            id=m.id,
            project_id=m.project_id,
            name=m.name,
            path=m.path,
            parent_id=m.parent_id,
            depth=m.depth,
            sort_order=m.sort_order,
            goal=m.goal or "",
            start_date=m.start_date,
            end_date=m.end_date,
            state=m.state or "planned",
            created_at=m.created_at,
            updated_at=m.updated_at,
        )

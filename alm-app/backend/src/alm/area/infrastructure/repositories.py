"""AreaNode SQLAlchemy repository."""

from __future__ import annotations

import uuid

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from alm.area.domain.entities import AreaNode
from alm.area.domain.ports import AreaRepository
from alm.area.infrastructure.models import AreaNodeModel


class SqlAlchemyAreaRepository(AreaRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def find_by_id(self, area_node_id: uuid.UUID) -> AreaNode | None:
        result = await self._session.execute(select(AreaNodeModel).where(AreaNodeModel.id == area_node_id))
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def list_by_project(self, project_id: uuid.UUID) -> list[AreaNode]:
        result = await self._session.execute(
            select(AreaNodeModel).where(AreaNodeModel.project_id == project_id).order_by(AreaNodeModel.path.asc())
        )
        return [self._to_entity(m) for m in result.scalars().all()]

    async def find_by_project_and_path(self, project_id: uuid.UUID, path: str) -> AreaNode | None:
        result = await self._session.execute(
            select(AreaNodeModel).where(
                AreaNodeModel.project_id == project_id,
                AreaNodeModel.path == path,
            )
        )
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def find_by_project_and_path_prefix(self, project_id: uuid.UUID, path_prefix: str) -> list[AreaNode]:
        # path = path_prefix OR path starts with path_prefix + '/'
        pattern = path_prefix.rstrip("/") + "/"
        result = await self._session.execute(
            select(AreaNodeModel)
            .where(AreaNodeModel.project_id == project_id)
            .where((AreaNodeModel.path == path_prefix) | (AreaNodeModel.path.startswith(pattern)))
            .order_by(AreaNodeModel.path.asc())
        )
        return [self._to_entity(m) for m in result.scalars().all()]

    async def add(self, node: AreaNode) -> AreaNode:
        model = AreaNodeModel(
            id=node.id,
            project_id=node.project_id,
            name=node.name,
            parent_id=node.parent_id,
            path=node.path,
            depth=node.depth,
            sort_order=node.sort_order,
            is_active=node.is_active,
        )
        self._session.add(model)
        await self._session.flush()
        return node

    async def update(self, node: AreaNode) -> AreaNode:
        await self._session.execute(
            update(AreaNodeModel)
            .where(AreaNodeModel.id == node.id)
            .values(
                name=node.name,
                path=node.path,
                parent_id=node.parent_id,
                depth=node.depth,
                sort_order=node.sort_order,
                is_active=node.is_active,
            )
        )
        await self._session.flush()
        return node

    async def delete(self, area_node_id: uuid.UUID) -> bool:
        result = await self._session.execute(delete(AreaNodeModel).where(AreaNodeModel.id == area_node_id))
        await self._session.flush()
        return bool(getattr(result, "rowcount", 0))

    @staticmethod
    def _to_entity(m: AreaNodeModel) -> AreaNode:
        return AreaNode(
            id=m.id,
            project_id=m.project_id,
            name=m.name,
            path=m.path,
            parent_id=m.parent_id,
            depth=m.depth,
            sort_order=m.sort_order,
            is_active=m.is_active,
            created_at=m.created_at,
            updated_at=m.updated_at,
        )

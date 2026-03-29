"""ArtifactLink SQLAlchemy repository."""

from __future__ import annotations

import uuid

from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from alm.artifact_link.domain.entities import ArtifactLink
from alm.artifact_link.domain.ports import ArtifactLinkRepository
from alm.artifact_link.infrastructure.models import ArtifactLinkModel


class SqlAlchemyArtifactLinkRepository(ArtifactLinkRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def find_by_id(self, link_id: uuid.UUID) -> ArtifactLink | None:
        result = await self._session.execute(select(ArtifactLinkModel).where(ArtifactLinkModel.id == link_id))
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def list_by_artifact(
        self,
        project_id: uuid.UUID,
        artifact_id: uuid.UUID,
    ) -> list[ArtifactLink]:
        result = await self._session.execute(
            select(ArtifactLinkModel).where(
                ArtifactLinkModel.project_id == project_id,
                or_(
                    ArtifactLinkModel.from_artifact_id == artifact_id,
                    ArtifactLinkModel.to_artifact_id == artifact_id,
                ),
            )
        )
        rows = list(result.scalars().all())
        outgoing = [m for m in rows if m.from_artifact_id == artifact_id]
        incoming = [m for m in rows if m.to_artifact_id == artifact_id]

        def _outgoing_key(m: ArtifactLinkModel) -> tuple:
            so = m.sort_order
            return (so is None, so if so is not None else 0, m.created_at.timestamp() if m.created_at else 0.0)

        outgoing.sort(key=_outgoing_key)
        incoming.sort(key=lambda m: m.created_at.timestamp() if m.created_at else 0.0, reverse=True)
        return [self._to_entity(m) for m in outgoing + incoming]

    async def add(self, link: ArtifactLink) -> ArtifactLink:
        model = ArtifactLinkModel(
            id=link.id,
            project_id=link.project_id,
            from_artifact_id=link.from_artifact_id,
            to_artifact_id=link.to_artifact_id,
            link_type=link.link_type,
            sort_order=link.sort_order,
        )
        self._session.add(model)
        await self._session.flush()
        return link

    async def delete(self, link_id: uuid.UUID) -> bool:
        result = await self._session.execute(select(ArtifactLinkModel).where(ArtifactLinkModel.id == link_id))
        model = result.scalar_one_or_none()
        if model is None:
            return False
        await self._session.delete(model)
        await self._session.flush()
        return True

    async def max_sort_order_for_outgoing(
        self,
        project_id: uuid.UUID,
        from_artifact_id: uuid.UUID,
        link_type: str,
    ) -> int | None:
        result = await self._session.execute(
            select(func.max(ArtifactLinkModel.sort_order)).where(
                and_(
                    ArtifactLinkModel.project_id == project_id,
                    ArtifactLinkModel.from_artifact_id == from_artifact_id,
                    ArtifactLinkModel.link_type == link_type,
                )
            )
        )
        return result.scalar_one()

    async def list_outgoing_link_ids(
        self,
        project_id: uuid.UUID,
        from_artifact_id: uuid.UUID,
        link_type: str,
    ) -> list[uuid.UUID]:
        result = await self._session.execute(
            select(ArtifactLinkModel.id)
            .where(
                and_(
                    ArtifactLinkModel.project_id == project_id,
                    ArtifactLinkModel.from_artifact_id == from_artifact_id,
                    ArtifactLinkModel.link_type == link_type,
                )
            )
            .order_by(
                ArtifactLinkModel.sort_order.asc().nulls_last(),
                ArtifactLinkModel.created_at.asc(),
            )
        )
        return [row[0] for row in result.all()]

    async def set_sort_orders_for_outgoing(
        self,
        project_id: uuid.UUID,
        from_artifact_id: uuid.UUID,
        link_type: str,
        ordered_link_ids: list[uuid.UUID],
    ) -> None:
        for idx, lid in enumerate(ordered_link_ids):
            await self._session.execute(
                update(ArtifactLinkModel)
                .where(
                    and_(
                        ArtifactLinkModel.id == lid,
                        ArtifactLinkModel.project_id == project_id,
                        ArtifactLinkModel.from_artifact_id == from_artifact_id,
                        ArtifactLinkModel.link_type == link_type,
                    )
                )
                .values(sort_order=idx)
            )
        await self._session.flush()

    async def exists(
        self,
        from_artifact_id: uuid.UUID,
        to_artifact_id: uuid.UUID,
        link_type: str,
    ) -> bool:
        result = await self._session.execute(
            select(ArtifactLinkModel.id)
            .where(
                and_(
                    ArtifactLinkModel.from_artifact_id == from_artifact_id,
                    ArtifactLinkModel.to_artifact_id == to_artifact_id,
                    ArtifactLinkModel.link_type == link_type,
                )
            )
            .limit(1)
        )
        return result.scalar_one_or_none() is not None

    @staticmethod
    def _to_entity(m: ArtifactLinkModel) -> ArtifactLink:
        return ArtifactLink(
            id=m.id,
            project_id=m.project_id,
            from_artifact_id=m.from_artifact_id,
            to_artifact_id=m.to_artifact_id,
            link_type=m.link_type,
            created_at=m.created_at,
            sort_order=m.sort_order,
        )

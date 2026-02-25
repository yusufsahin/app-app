"""ArtifactLink SQLAlchemy repository."""

from __future__ import annotations

import uuid

from sqlalchemy import or_, select
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
            select(ArtifactLinkModel)
            .where(
                ArtifactLinkModel.project_id == project_id,
                or_(
                    ArtifactLinkModel.from_artifact_id == artifact_id,
                    ArtifactLinkModel.to_artifact_id == artifact_id,
                ),
            )
            .order_by(ArtifactLinkModel.created_at.desc())
        )
        return [self._to_entity(m) for m in result.scalars().all()]

    async def add(self, link: ArtifactLink) -> ArtifactLink:
        model = ArtifactLinkModel(
            id=link.id,
            project_id=link.project_id,
            from_artifact_id=link.from_artifact_id,
            to_artifact_id=link.to_artifact_id,
            link_type=link.link_type,
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

    async def exists(
        self,
        from_artifact_id: uuid.UUID,
        to_artifact_id: uuid.UUID,
        link_type: str,
    ) -> bool:
        from sqlalchemy import and_

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
        )

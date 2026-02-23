"""Artifact SQLAlchemy repository."""
from __future__ import annotations

import uuid

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from alm.artifact.domain.entities import Artifact
from alm.artifact.domain.ports import ArtifactRepository
from alm.artifact.infrastructure.models import ArtifactModel


class SqlAlchemyArtifactRepository(ArtifactRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def find_by_id(self, artifact_id: uuid.UUID) -> Artifact | None:
        result = await self._session.execute(
            select(ArtifactModel).where(
                ArtifactModel.id == artifact_id,
                ArtifactModel.deleted_at.is_(None),
            )
        )
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def list_by_project(
        self, project_id: uuid.UUID, state_filter: str | None = None
    ) -> list[Artifact]:
        q = select(ArtifactModel).where(
            ArtifactModel.project_id == project_id,
            ArtifactModel.deleted_at.is_(None),
        )
        if state_filter:
            q = q.where(ArtifactModel.state == state_filter)
        q = q.order_by(ArtifactModel.created_at.desc())
        result = await self._session.execute(q)
        return [self._to_entity(m) for m in result.scalars().all()]

    async def add(self, artifact: Artifact) -> Artifact:
        model = ArtifactModel(
            id=artifact.id,
            project_id=artifact.project_id,
            artifact_type=artifact.artifact_type,
            title=artifact.title,
            description=artifact.description,
            state=artifact.state,
            assignee_id=artifact.assignee_id,
            parent_id=artifact.parent_id,
            custom_fields=artifact.custom_fields or {},
        )
        self._session.add(model)
        await self._session.flush()
        return artifact

    async def update(self, artifact: Artifact) -> Artifact:
        await self._session.execute(
            update(ArtifactModel)
            .where(ArtifactModel.id == artifact.id)
            .values(
                title=artifact.title,
                description=artifact.description,
                state=artifact.state,
                assignee_id=artifact.assignee_id,
                parent_id=artifact.parent_id,
                custom_fields=artifact.custom_fields or {},
            )
        )
        await self._session.flush()
        return artifact

    @staticmethod
    def _to_entity(m: ArtifactModel) -> Artifact:
        return Artifact(
            id=m.id,
            project_id=m.project_id,
            artifact_type=m.artifact_type,
            title=m.title,
            description=m.description or "",
            state=m.state,
            assignee_id=m.assignee_id,
            parent_id=m.parent_id,
            custom_fields=getattr(m, "custom_fields", None) or {},
        )

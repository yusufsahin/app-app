"""Attachment SQLAlchemy repository."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from alm.attachment.domain.entities import Attachment
from alm.attachment.domain.ports import AttachmentRepository
from alm.attachment.infrastructure.models import AttachmentModel


class SqlAlchemyAttachmentRepository(AttachmentRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def find_by_id(self, attachment_id: uuid.UUID) -> Attachment | None:
        result = await self._session.execute(select(AttachmentModel).where(AttachmentModel.id == attachment_id))
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def list_by_artifact(self, artifact_id: uuid.UUID) -> list[Attachment]:
        result = await self._session.execute(
            select(AttachmentModel)
            .where(AttachmentModel.artifact_id == artifact_id)
            .order_by(AttachmentModel.created_at.asc())
        )
        return [self._to_entity(m) for m in result.scalars().all()]

    async def add(self, attachment: Attachment) -> Attachment:
        model = AttachmentModel(
            id=attachment.id,
            project_id=attachment.project_id,
            artifact_id=attachment.artifact_id,
            file_name=attachment.file_name,
            content_type=attachment.content_type,
            size=attachment.size,
            storage_key=attachment.storage_key,
            created_by=attachment.created_by,
        )
        self._session.add(model)
        await self._session.flush()
        return attachment

    async def delete(self, attachment_id: uuid.UUID) -> bool:
        result = await self._session.execute(select(AttachmentModel).where(AttachmentModel.id == attachment_id))
        model = result.scalar_one_or_none()
        if model is None:
            return False
        await self._session.delete(model)
        await self._session.flush()
        return True

    @staticmethod
    def _to_entity(m: AttachmentModel) -> Attachment:
        return Attachment(
            id=m.id,
            project_id=m.project_id,
            artifact_id=m.artifact_id,
            file_name=m.file_name,
            content_type=m.content_type,
            size=m.size,
            storage_key=m.storage_key,
            created_by=m.created_by,
            created_at=m.created_at,
        )

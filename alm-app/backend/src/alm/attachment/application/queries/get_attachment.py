"""Get single attachment by id (for download)."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.attachment.application.dtos import AttachmentDTO
from alm.attachment.domain.ports import AttachmentRepository
from alm.shared.application.query import Query, QueryHandler


@dataclass(frozen=True)
class GetAttachment(Query):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    artifact_id: uuid.UUID
    attachment_id: uuid.UUID


class GetAttachmentHandler(QueryHandler[AttachmentDTO | None]):
    def __init__(self, attachment_repo: AttachmentRepository) -> None:
        self._attachment_repo = attachment_repo

    async def handle(self, query: Query) -> AttachmentDTO | None:
        assert isinstance(query, GetAttachment)

        attachment = await self._attachment_repo.find_by_id(query.attachment_id)
        if attachment is None:
            return None
        if attachment.project_id != query.project_id or attachment.artifact_id != query.artifact_id:
            return None
        return AttachmentDTO(
            id=attachment.id,
            project_id=attachment.project_id,
            artifact_id=attachment.artifact_id,
            file_name=attachment.file_name,
            content_type=attachment.content_type,
            size=attachment.size,
            storage_key=attachment.storage_key,
            created_by=attachment.created_by,
            created_at=attachment.created_at.isoformat() if attachment.created_at else None,
        )

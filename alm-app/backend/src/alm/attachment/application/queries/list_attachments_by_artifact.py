"""List attachments for an artifact."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.attachment.application.dtos import AttachmentDTO
from alm.attachment.domain.ports import AttachmentRepository
from alm.shared.application.query import Query, QueryHandler


@dataclass(frozen=True)
class ListAttachmentsByArtifact(Query):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    artifact_id: uuid.UUID


class ListAttachmentsByArtifactHandler(QueryHandler[list[AttachmentDTO]]):
    def __init__(self, attachment_repo: AttachmentRepository) -> None:
        self._attachment_repo = attachment_repo

    async def handle(self, query: Query) -> list[AttachmentDTO]:
        assert isinstance(query, ListAttachmentsByArtifact)

        attachments = await self._attachment_repo.list_by_artifact(query.artifact_id)
        return [
            AttachmentDTO(
                id=a.id,
                project_id=a.project_id,
                artifact_id=a.artifact_id,
                file_name=a.file_name,
                content_type=a.content_type,
                size=a.size,
                storage_key=a.storage_key,
                created_by=a.created_by,
                created_at=a.created_at.isoformat() if a.created_at else None,
            )
            for a in attachments
        ]

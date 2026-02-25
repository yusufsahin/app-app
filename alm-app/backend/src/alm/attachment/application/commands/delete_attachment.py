"""Delete attachment (remove from repo and storage)."""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ValidationError
from alm.attachment.domain.ports import AttachmentRepository, FileStoragePort


@dataclass(frozen=True)
class DeleteAttachment(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    artifact_id: uuid.UUID
    attachment_id: uuid.UUID


class DeleteAttachmentHandler(CommandHandler[bool]):
    def __init__(
        self,
        attachment_repo: AttachmentRepository,
        storage: FileStoragePort,
    ) -> None:
        self._attachment_repo = attachment_repo
        self._storage = storage

    async def handle(self, command: Command) -> bool:
        assert isinstance(command, DeleteAttachment)

        attachment = await self._attachment_repo.find_by_id(command.attachment_id)
        if attachment is None:
            raise ValidationError("Attachment not found")
        if attachment.project_id != command.project_id or attachment.artifact_id != command.artifact_id:
            raise ValidationError("Attachment not found")

        await self._storage.delete(attachment.storage_key)
        return await self._attachment_repo.delete(command.attachment_id)

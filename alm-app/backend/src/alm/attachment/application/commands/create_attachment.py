"""Create attachment (upload file to artifact)."""
from __future__ import annotations

import re
import uuid
from dataclasses import dataclass

from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ValidationError
from alm.attachment.application.dtos import AttachmentDTO
from alm.attachment.domain.entities import Attachment
from alm.attachment.domain.ports import AttachmentRepository, FileStoragePort
from alm.artifact.domain.ports import ArtifactRepository
from alm.project.domain.ports import ProjectRepository

# Max size 10 MiB
MAX_FILE_SIZE = 10 * 1024 * 1024
# Sanitize filename: keep alphanumeric, dash, underscore, dot
FILENAME_SAFE = re.compile(r"[^\w.\-]", re.ASCII)


@dataclass(frozen=True)
class CreateAttachment(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    artifact_id: uuid.UUID
    file_name: str
    content_type: str
    file_content: bytes
    created_by: uuid.UUID | None


class CreateAttachmentHandler(CommandHandler[AttachmentDTO]):
    def __init__(
        self,
        attachment_repo: AttachmentRepository,
        storage: FileStoragePort,
        artifact_repo: ArtifactRepository,
        project_repo: ProjectRepository,
    ) -> None:
        self._attachment_repo = attachment_repo
        self._storage = storage
        self._artifact_repo = artifact_repo
        self._project_repo = project_repo

    async def handle(self, command: Command) -> AttachmentDTO:
        assert isinstance(command, CreateAttachment)

        project = await self._project_repo.find_by_id(command.project_id)
        if project is None or project.tenant_id != command.tenant_id:
            raise ValidationError("Project not found")

        artifact = await self._artifact_repo.find_by_id(command.artifact_id)
        if artifact is None or artifact.project_id != command.project_id:
            raise ValidationError("Artifact not found")

        if len(command.file_content) > MAX_FILE_SIZE:
            raise ValidationError(f"File size exceeds maximum ({MAX_FILE_SIZE // (1024*1024)} MiB)")

        file_name = (command.file_name or "file").strip()
        if not file_name or file_name in (".", ".."):
            file_name = "file"
        safe_name = FILENAME_SAFE.sub("_", file_name)[:200] or "file"
        attachment_id = uuid.uuid4()
        storage_key = f"{command.tenant_id}/{command.project_id}/{command.artifact_id}/{attachment_id}_{safe_name}"
        content_type_val = (command.content_type or "application/octet-stream").strip()[:255]

        attachment = Attachment.create(
            project_id=command.project_id,
            artifact_id=command.artifact_id,
            file_name=file_name,
            content_type=content_type_val,
            size=len(command.file_content),
            storage_key=storage_key,
            created_by=command.created_by,
            id=attachment_id,
        )
        await self._storage.save(storage_key, command.file_content, attachment.content_type)
        await self._attachment_repo.add(attachment)

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

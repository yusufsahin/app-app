"""Attachment repository and file storage ports."""
from __future__ import annotations

import uuid
from abc import abstractmethod
from typing import AsyncIterator

from alm.attachment.domain.entities import Attachment


class AttachmentRepository:
    @abstractmethod
    async def find_by_id(self, attachment_id: uuid.UUID) -> Attachment | None:
        ...

    @abstractmethod
    async def list_by_artifact(self, artifact_id: uuid.UUID) -> list[Attachment]:
        ...

    @abstractmethod
    async def add(self, attachment: Attachment) -> Attachment:
        ...

    @abstractmethod
    async def delete(self, attachment_id: uuid.UUID) -> bool:
        ...


class FileStoragePort:
    """Port for storing and retrieving file bytes (e.g. local disk or S3)."""

    @abstractmethod
    async def save(self, storage_key: str, content: bytes, content_type: str | None = None) -> None:
        ...

    @abstractmethod
    async def read(self, storage_key: str) -> bytes:
        ...

    @abstractmethod
    async def delete(self, storage_key: str) -> bool:
        ...

    @abstractmethod
    async def exists(self, storage_key: str) -> bool:
        ...

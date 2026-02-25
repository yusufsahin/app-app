"""Local filesystem file storage for attachments."""
from __future__ import annotations

import os
from pathlib import Path

from alm.attachment.domain.ports import FileStoragePort


class LocalFileStorage(FileStoragePort):
    """Store files under base_path. storage_key is a relative path (e.g. tenant/project/artifact/id_name)."""

    def __init__(self, base_path: str | Path) -> None:
        self._base = Path(base_path)

    def _full_path(self, storage_key: str) -> Path:
        # Avoid path traversal
        key = storage_key.lstrip("/").replace("..", "")
        return self._base / key

    async def save(self, storage_key: str, content: bytes, content_type: str | None = None) -> None:
        full = self._full_path(storage_key)
        full.parent.mkdir(parents=True, exist_ok=True)
        full.write_bytes(content)

    async def read(self, storage_key: str) -> bytes:
        full = self._full_path(storage_key)
        return full.read_bytes()

    async def delete(self, storage_key: str) -> bool:
        full = self._full_path(storage_key)
        if not full.exists():
            return False
        full.unlink()
        return True

    async def exists(self, storage_key: str) -> bool:
        return self._full_path(storage_key).exists()

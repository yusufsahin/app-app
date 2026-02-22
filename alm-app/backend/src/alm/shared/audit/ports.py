"""Audit repository ports (domain interfaces)."""

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod

from alm.shared.audit.core import AuditCommit, AuditSnapshot


class AuditStore(ABC):
    """Write-side: persist commits and snapshots."""

    @abstractmethod
    async def save_commit(self, commit: AuditCommit) -> None: ...

    @abstractmethod
    async def save_snapshot(self, snapshot: AuditSnapshot) -> None: ...

    @abstractmethod
    async def get_latest_snapshot(self, global_id: str) -> AuditSnapshot | None: ...


class AuditReader(ABC):
    """Read-side: query audit history."""

    @abstractmethod
    async def get_snapshots(
        self,
        entity_type: str,
        entity_id: uuid.UUID,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> list[AuditSnapshot]: ...

    @abstractmethod
    async def get_snapshot_by_version(
        self,
        entity_type: str,
        entity_id: uuid.UUID,
        version: int,
    ) -> AuditSnapshot | None: ...

    @abstractmethod
    async def get_commit(self, commit_id: uuid.UUID) -> AuditCommit | None: ...

    @abstractmethod
    async def get_changes_by_commit(self, commit_id: uuid.UUID) -> list[AuditSnapshot]: ...

    @abstractmethod
    async def get_entity_types(self) -> list[str]: ...

"""SQLAlchemy implementations of AuditStore and AuditReader."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from alm.shared.audit.core import AuditCommit, AuditSnapshot, ChangeType
from alm.shared.audit.models import AuditCommitModel, AuditSnapshotModel
from alm.shared.audit.ports import AuditReader, AuditStore


class SqlAlchemyAuditStore(AuditStore):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def save_commit(self, commit: AuditCommit) -> None:
        model = AuditCommitModel(
            id=commit.id,
            author_id=commit.author_id,
            tenant_id=commit.tenant_id,
            committed_at=commit.committed_at,
            properties=commit.properties,
        )
        self._session.add(model)
        await self._session.flush()

    async def save_snapshot(self, snapshot: AuditSnapshot) -> None:
        model = AuditSnapshotModel(
            id=snapshot.id,
            commit_id=snapshot.commit_id,
            global_id=snapshot.global_id,
            entity_type=snapshot.entity_type,
            entity_id=snapshot.entity_id,
            change_type=snapshot.change_type.value,
            state=snapshot.state,
            changed_properties=snapshot.changed_properties,
            version=snapshot.version,
        )
        self._session.add(model)
        await self._session.flush()

    async def get_latest_snapshot(self, global_id: str) -> AuditSnapshot | None:
        result = await self._session.execute(
            select(AuditSnapshotModel)
            .where(AuditSnapshotModel.global_id == global_id)
            .order_by(AuditSnapshotModel.version.desc())
            .limit(1)
        )
        model = result.scalar_one_or_none()
        return _to_snapshot_domain(model) if model else None


class SqlAlchemyAuditReader(AuditReader):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_snapshots(
        self,
        entity_type: str,
        entity_id: uuid.UUID,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> list[AuditSnapshot]:
        result = await self._session.execute(
            select(AuditSnapshotModel)
            .where(
                AuditSnapshotModel.entity_type == entity_type,
                AuditSnapshotModel.entity_id == entity_id,
            )
            .order_by(AuditSnapshotModel.version.desc())
            .limit(limit)
            .offset(offset)
        )
        return [_to_snapshot_domain(m) for m in result.scalars().all()]

    async def get_snapshot_by_version(
        self,
        entity_type: str,
        entity_id: uuid.UUID,
        version: int,
    ) -> AuditSnapshot | None:
        result = await self._session.execute(
            select(AuditSnapshotModel).where(
                AuditSnapshotModel.entity_type == entity_type,
                AuditSnapshotModel.entity_id == entity_id,
                AuditSnapshotModel.version == version,
            )
        )
        model = result.scalar_one_or_none()
        return _to_snapshot_domain(model) if model else None

    async def get_commit(self, commit_id: uuid.UUID) -> AuditCommit | None:
        result = await self._session.execute(select(AuditCommitModel).where(AuditCommitModel.id == commit_id))
        model = result.scalar_one_or_none()
        return _to_commit_domain(model) if model else None

    async def get_changes_by_commit(self, commit_id: uuid.UUID) -> list[AuditSnapshot]:
        result = await self._session.execute(
            select(AuditSnapshotModel)
            .where(AuditSnapshotModel.commit_id == commit_id)
            .order_by(AuditSnapshotModel.entity_type, AuditSnapshotModel.version)
        )
        return [_to_snapshot_domain(m) for m in result.scalars().all()]

    async def get_entity_types(self) -> list[str]:
        result = await self._session.execute(select(AuditSnapshotModel.entity_type).distinct())
        return sorted(result.scalars().all())


def _to_snapshot_domain(model: AuditSnapshotModel) -> AuditSnapshot:
    return AuditSnapshot(
        id=model.id,
        commit_id=model.commit_id,
        global_id=model.global_id,
        entity_type=model.entity_type,
        entity_id=model.entity_id,
        change_type=ChangeType(model.change_type),
        state=model.state,
        changed_properties=list(model.changed_properties or []),
        version=model.version,
    )


def _to_commit_domain(model: AuditCommitModel) -> AuditCommit:
    return AuditCommit(
        id=model.id,
        author_id=model.author_id,
        tenant_id=model.tenant_id,
        committed_at=model.committed_at,
        properties=model.properties or {},
    )

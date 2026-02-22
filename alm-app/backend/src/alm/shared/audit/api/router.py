from __future__ import annotations

import uuid
from collections.abc import AsyncGenerator

from fastapi import APIRouter, Depends, Query

from alm.shared.audit.api.schemas import ChangeSchema, EntityHistorySchema, SnapshotSchema
from alm.shared.audit.core import DiffEngine
from alm.shared.audit.dtos import ChangeDTO, EntityHistoryDTO, PropertyChangeDTO, SnapshotDTO
from alm.shared.audit.repository import SqlAlchemyAuditReader
from alm.shared.domain.exceptions import EntityNotFound
from alm.shared.infrastructure.db.session import async_session_factory

router = APIRouter(prefix="/audit", tags=["audit"])


async def _get_reader() -> AsyncGenerator[SqlAlchemyAuditReader, None]:
    async with async_session_factory() as session:
        yield SqlAlchemyAuditReader(session)


@router.get("/{entity_type}/{entity_id}/history", response_model=EntityHistorySchema)
async def get_entity_history(
    entity_type: str,
    entity_id: uuid.UUID,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    reader: SqlAlchemyAuditReader = Depends(_get_reader),
) -> EntityHistorySchema:
    snapshots = await reader.get_snapshots(
        entity_type, entity_id, limit=limit, offset=offset,
    )

    entries: list[ChangeDTO] = []
    for i, snap in enumerate(snapshots):
        commit = await reader.get_commit(snap.commit_id)
        snap_dto = SnapshotDTO(
            id=snap.id,
            commit_id=snap.commit_id,
            global_id=snap.global_id,
            entity_type=snap.entity_type,
            entity_id=snap.entity_id,
            change_type=snap.change_type.value if hasattr(snap.change_type, "value") else snap.change_type,
            state=snap.state,
            changed_properties=snap.changed_properties,
            version=snap.version,
            committed_at=commit.committed_at if commit else None,
            author_id=commit.author_id if commit else None,
        )

        prev_state = snapshots[i + 1].state if i + 1 < len(snapshots) else None
        prop_changes = DiffEngine.diff(prev_state, snap.state)
        change_dtos = [
            PropertyChangeDTO(p.property_name, p.left, p.right) for p in prop_changes
        ]
        entries.append(ChangeDTO(snapshot=snap_dto, changes=change_dtos))

    history = EntityHistoryDTO(
        entity_type=entity_type,
        entity_id=entity_id,
        total_versions=len(snapshots),
        entries=entries,
    )

    return EntityHistorySchema(
        entity_type=history.entity_type,
        entity_id=history.entity_id,
        total_versions=history.total_versions,
        entries=[
            ChangeSchema(
                snapshot=SnapshotSchema(**e.snapshot.__dict__),
                changes=[
                    {"property_name": c.property_name, "left": c.left, "right": c.right}
                    for c in e.changes
                ],
            )
            for e in history.entries
        ],
    )


@router.get(
    "/{entity_type}/{entity_id}/snapshots/{version}",
    response_model=SnapshotSchema,
)
async def get_snapshot_version(
    entity_type: str,
    entity_id: uuid.UUID,
    version: int,
    reader: SqlAlchemyAuditReader = Depends(_get_reader),
) -> SnapshotSchema:
    snapshot = await reader.get_snapshot_by_version(entity_type, entity_id, version)
    if snapshot is None:
        raise EntityNotFound("AuditSnapshot", entity_id)
    commit = await reader.get_commit(snapshot.commit_id)
    return SnapshotSchema(
        id=snapshot.id,
        commit_id=snapshot.commit_id,
        global_id=snapshot.global_id,
        entity_type=snapshot.entity_type,
        entity_id=snapshot.entity_id,
        change_type=snapshot.change_type.value if hasattr(snapshot.change_type, "value") else snapshot.change_type,
        state=snapshot.state,
        changed_properties=snapshot.changed_properties,
        version=snapshot.version,
        committed_at=commit.committed_at if commit else None,
        author_id=commit.author_id if commit else None,
    )

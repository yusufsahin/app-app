from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.query import Query, QueryHandler
from alm.shared.audit.core import DiffEngine
from alm.shared.audit.dtos import ChangeDTO, EntityHistoryDTO, PropertyChangeDTO, SnapshotDTO
from alm.shared.audit.ports import AuditReader


@dataclass(frozen=True)
class GetEntityHistory(Query):
    entity_type: str
    entity_id: uuid.UUID
    limit: int = 50
    offset: int = 0


class GetEntityHistoryHandler(QueryHandler[EntityHistoryDTO]):
    def __init__(self, audit_reader: AuditReader) -> None:
        self._reader = audit_reader

    async def handle(self, query: Query) -> EntityHistoryDTO:
        assert isinstance(query, GetEntityHistory)
        snapshots = await self._reader.get_snapshots(
            query.entity_type,
            query.entity_id,
            limit=query.limit,
            offset=query.offset,
        )

        entries: list[ChangeDTO] = []
        for i, snap in enumerate(snapshots):
            commit = await self._reader.get_commit(snap.commit_id)
            snap_dto = SnapshotDTO(
                id=snap.id,
                commit_id=snap.commit_id,
                global_id=snap.global_id,
                entity_type=snap.entity_type,
                entity_id=snap.entity_id,
                change_type=snap.change_type.value,
                state=snap.state,
                changed_properties=snap.changed_properties,
                version=snap.version,
                committed_at=commit.committed_at if commit else None,
                author_id=commit.author_id if commit else None,
            )

            prev_state = snapshots[i + 1].state if i + 1 < len(snapshots) else None
            prop_changes = DiffEngine.diff(prev_state, snap.state)
            change_dtos = [
                PropertyChangeDTO(p.property_name, p.left, p.right)
                for p in prop_changes
            ]
            entries.append(ChangeDTO(snapshot=snap_dto, changes=change_dtos))

        return EntityHistoryDTO(
            entity_type=query.entity_type,
            entity_id=query.entity_id,
            total_versions=len(snapshots),
            entries=entries,
        )

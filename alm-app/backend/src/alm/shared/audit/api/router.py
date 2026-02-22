from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query

from alm.config.dependencies import get_mediator
from alm.shared.application.mediator import Mediator
from alm.shared.audit.api.schemas import (
    ChangeSchema,
    EntityHistorySchema,
    PropertyChangeSchema,
    SnapshotSchema,
)
from alm.shared.audit.dtos import EntityHistoryDTO, SnapshotDTO
from alm.shared.audit.queries import GetEntityHistory
from alm.shared.audit.repository import SqlAlchemyAuditReader
from alm.shared.domain.exceptions import EntityNotFound

router = APIRouter(prefix="/audit", tags=["audit"])


def _history_to_schema(history: EntityHistoryDTO) -> EntityHistorySchema:
    return EntityHistorySchema(
        entity_type=history.entity_type,
        entity_id=history.entity_id,
        total_versions=history.total_versions,
        entries=[
            ChangeSchema(
                snapshot=SnapshotSchema(**e.snapshot.__dict__),
                changes=[
                    PropertyChangeSchema(
                        property_name=c.property_name, left=c.left, right=c.right,
                    )
                    for c in e.changes
                ],
            )
            for e in history.entries
        ],
    )


@router.get("/{entity_type}/{entity_id}/history", response_model=EntityHistorySchema)
async def get_entity_history(
    entity_type: str,
    entity_id: uuid.UUID,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    mediator: Mediator = Depends(get_mediator),
) -> EntityHistorySchema:
    history: EntityHistoryDTO = await mediator.query(
        GetEntityHistory(
            entity_type=entity_type,
            entity_id=entity_id,
            limit=limit,
            offset=offset,
        )
    )
    return _history_to_schema(history)


@router.get(
    "/{entity_type}/{entity_id}/snapshots/{version}",
    response_model=SnapshotSchema,
)
async def get_snapshot_version(
    entity_type: str,
    entity_id: uuid.UUID,
    version: int,
    mediator: Mediator = Depends(get_mediator),
) -> SnapshotSchema:
    history: EntityHistoryDTO = await mediator.query(
        GetEntityHistory(
            entity_type=entity_type,
            entity_id=entity_id,
            limit=1,
            offset=version - 1,
        )
    )
    if not history.entries:
        raise EntityNotFound("AuditSnapshot", entity_id)

    return SnapshotSchema(**history.entries[0].snapshot.__dict__)

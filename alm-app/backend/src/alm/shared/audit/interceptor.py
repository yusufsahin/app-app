"""Audit interceptor — processes buffered entries and creates commits/snapshots.

Repositories call ``buffer_audit()`` after add/update/soft_delete.  The
``AuditInterceptor`` is invoked by the Mediator just before ``session.commit()``
so that audit records land in the same transaction as the domain changes.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from alm.shared.audit.core import ChangeType, DiffEngine

AUDIT_BUFFER_KEY = "_audit_entries"
ACTOR_ID_KEY = "_actor_id"
TENANT_ID_KEY = "_tenant_id"


def buffer_audit(
    session: AsyncSession,
    entity_type: str,
    entity_id: uuid.UUID,
    state: dict[str, Any],
    change_type: ChangeType,
) -> None:
    """Buffer an audit entry in the session info dict.

    Called by repositories after add/update/soft_delete.
    """
    session.info.setdefault(AUDIT_BUFFER_KEY, []).append(
        {
            "entity_type": entity_type,
            "entity_id": entity_id,
            "state": state,
            "change_type": change_type,
        }
    )


class AuditInterceptor:
    """Processes buffered audit entries before commit.

    Creates an AuditCommit and AuditSnapshots with diff computation.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def process(self) -> None:
        entries = self._session.info.pop(AUDIT_BUFFER_KEY, [])
        if not entries:
            return

        from alm.shared.audit.models import AuditCommitModel, AuditSnapshotModel

        author_id = self._session.info.get(ACTOR_ID_KEY)
        tenant_id = self._session.info.get(TENANT_ID_KEY)

        commit_id = uuid.uuid4()
        commit = AuditCommitModel(
            id=commit_id,
            author_id=author_id,
            tenant_id=tenant_id,
            committed_at=datetime.now(UTC),
            properties={},
        )
        self._session.add(commit)

        for entry in entries:
            global_id = f"{entry['entity_type']}/{entry['entity_id']}"

            result = await self._session.execute(
                select(AuditSnapshotModel)
                .where(AuditSnapshotModel.global_id == global_id)
                .order_by(AuditSnapshotModel.version.desc())
                .limit(1)
            )
            prev = result.scalar_one_or_none()

            version = (prev.version + 1) if prev else 1
            prev_state = prev.state if prev else None
            changed_props = DiffEngine.changed_property_names(prev_state, entry["state"])

            snapshot = AuditSnapshotModel(
                id=uuid.uuid4(),
                commit_id=commit_id,
                global_id=global_id,
                entity_type=entry["entity_type"],
                entity_id=entry["entity_id"],
                change_type=entry["change_type"].value,
                state=entry["state"],
                changed_properties=changed_props,
                version=version,
            )
            self._session.add(snapshot)

        await self._session.flush()
        self._session.info[AUDIT_BUFFER_KEY] = []

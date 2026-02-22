from __future__ import annotations

import uuid
from contextvars import ContextVar

from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

_current_tenant_id: ContextVar[uuid.UUID | None] = ContextVar("current_tenant_id", default=None)


def get_current_tenant_id() -> uuid.UUID | None:
    return _current_tenant_id.get()


def set_current_tenant_id(tenant_id: uuid.UUID | None) -> None:
    _current_tenant_id.set(tenant_id)


def setup_tenant_rls(session_factory: async_sessionmaker[AsyncSession]) -> None:
    """Register after_begin hook to SET LOCAL tenant_id for RLS."""

    @event.listens_for(session_factory.sync_session_class, "after_begin")
    def _set_tenant(session, transaction, connection):  # type: ignore[no-untyped-def]
        tenant_id = get_current_tenant_id()
        if tenant_id is not None:
            connection.execute(text(f"SET LOCAL app.current_tenant_id = '{tenant_id}'"))

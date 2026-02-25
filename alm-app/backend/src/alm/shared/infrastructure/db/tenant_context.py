from __future__ import annotations

import uuid
from contextvars import ContextVar

from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlalchemy.orm import Session

_current_tenant_id: ContextVar[uuid.UUID | None] = ContextVar("current_tenant_id", default=None)


def get_current_tenant_id() -> uuid.UUID | None:
    return _current_tenant_id.get()


def set_current_tenant_id(tenant_id: uuid.UUID | None) -> None:
    _current_tenant_id.set(tenant_id)


_rls_listener_registered: bool = False


def setup_tenant_rls(session_factory: async_sessionmaker) -> None:
    """Register after_begin hook to SET LOCAL tenant_id for RLS.
    Uses Session (sync) - AsyncSession's internal session fires the same event.
    Idempotent: only registers the listener once.
    """
    global _rls_listener_registered
    if _rls_listener_registered:
        return
    del session_factory  # unused; we listen on Session globally

    @event.listens_for(Session, "after_begin")
    def _set_tenant(session: object, transaction: object, connection: object) -> None:
        tenant_id = get_current_tenant_id()
        if tenant_id is not None:
            connection.execute(text(f"SET LOCAL app.current_tenant_id = '{tenant_id}'"))  # type: ignore[union-attr]

    _rls_listener_registered = True

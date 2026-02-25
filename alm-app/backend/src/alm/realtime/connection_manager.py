"""In-memory connection manager for WebSocket clients per tenant."""
from __future__ import annotations

import asyncio
import uuid

import structlog
from starlette.websockets import WebSocket

logger = structlog.get_logger()

CHANNEL_PREFIX = "alm:events:"


class ConnectionManager:
    """Maps tenant_id to set of WebSocket connections; broadcasts messages to tenant subscribers."""

    def __init__(self) -> None:
        self._connections: dict[uuid.UUID, set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def add(self, tenant_id: uuid.UUID, ws: WebSocket) -> None:
        async with self._lock:
            if tenant_id not in self._connections:
                self._connections[tenant_id] = set()
            self._connections[tenant_id].add(ws)
        logger.debug("realtime_connection_added", tenant_id=str(tenant_id))

    async def remove(self, tenant_id: uuid.UUID, ws: WebSocket) -> None:
        async with self._lock:
            if tenant_id in self._connections:
                self._connections[tenant_id].discard(ws)
                if not self._connections[tenant_id]:
                    del self._connections[tenant_id]
        logger.debug("realtime_connection_removed", tenant_id=str(tenant_id))

    async def broadcast(self, tenant_id: uuid.UUID, message: str) -> None:
        async with self._lock:
            conns = set(self._connections.get(tenant_id, ()))
        for ws in conns:
            try:
                await ws.send_text(message)
            except Exception as e:  # noqa: BLE001
                logger.warning("realtime_send_failed", tenant_id=str(tenant_id), error=str(e))
                async with self._lock:
                    if tenant_id in self._connections:
                        self._connections[tenant_id].discard(ws)


# Singleton used by WebSocket route and Redis subscriber
connection_manager = ConnectionManager()

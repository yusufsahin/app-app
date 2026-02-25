"""WebSocket endpoint for real-time events (C1)."""
from __future__ import annotations

import uuid

import structlog
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from alm.realtime.connection_manager import connection_manager
from alm.shared.infrastructure.security.jwt import InvalidTokenError, decode_token

logger = structlog.get_logger()

router = APIRouter()


@router.websocket("/ws")
async def websocket_realtime(websocket: WebSocket) -> None:
    """Connect with ?token=ACCESS_TOKEN. Receives tenant-scoped events (e.g. artifact_state_changed)."""
    await websocket.accept()
    token = websocket.query_params.get("token")
    if not token or not token.strip():
        await websocket.close(code=4001, reason="Missing token")
        return
    try:
        payload = decode_token(token.strip())
    except InvalidTokenError as e:
        await websocket.close(code=4001, reason="Invalid token")
        logger.debug("ws_invalid_token", error=str(e))
        return
    if payload.token_type != "access" or payload.tid is None:
        await websocket.close(code=4001, reason="Access token with tenant required")
        return
    tenant_id: uuid.UUID = payload.tid
    await connection_manager.add(tenant_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:  # noqa: BLE001
        pass
    finally:
        await connection_manager.remove(tenant_id, websocket)

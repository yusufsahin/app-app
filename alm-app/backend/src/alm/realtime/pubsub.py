"""Redis PubSub: publish tenant-scoped events and run subscriber that forwards to WebSocket manager."""

from __future__ import annotations

import asyncio
import json
import uuid
from typing import Any

import structlog

from alm.realtime.connection_manager import CHANNEL_PREFIX, connection_manager
from alm.shared.infrastructure.cache import get_redis

logger = structlog.get_logger()


def event_channel(tenant_id: uuid.UUID) -> str:
    return f"{CHANNEL_PREFIX}{tenant_id}"


async def publish_event(tenant_id: uuid.UUID, payload: dict[str, Any]) -> None:
    """Publish a JSON payload to the tenant's event channel (for WebSocket delivery)."""
    try:
        r = get_redis()
        channel = event_channel(tenant_id)
        await r.publish(channel, json.dumps(payload))
        logger.debug("realtime_event_published", channel=channel, type=payload.get("type"))
    except Exception as e:  # noqa: BLE001
        logger.warning("realtime_publish_failed", tenant_id=str(tenant_id), error=str(e))


async def run_subscriber() -> None:
    """Subscribe to alm:events:* and broadcast each message to the connection manager."""
    r = get_redis()
    pubsub = r.pubsub()
    await pubsub.psubscribe(f"{CHANNEL_PREFIX}*")
    logger.info("realtime_subscriber_started", pattern=f"{CHANNEL_PREFIX}*")
    try:
        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if message is None:
                continue
            if message["type"] != "pmessage":
                continue
            channel = message.get("channel")
            data = message.get("data")
            if not channel or data is None:
                continue
            # channel is bytes or str depending on decode_responses
            ch = channel.decode() if isinstance(channel, bytes) else channel
            if not ch.startswith(CHANNEL_PREFIX):
                continue
            tenant_id_str = ch[len(CHANNEL_PREFIX) :]
            try:
                tenant_id = uuid.UUID(tenant_id_str)
            except ValueError:
                continue
            payload = data.decode() if isinstance(data, bytes) else data
            await connection_manager.broadcast(tenant_id, payload)
    except asyncio.CancelledError:
        logger.info("realtime_subscriber_stopped")
        await pubsub.punsubscribe(f"{CHANNEL_PREFIX}*")
        await pubsub.close()
        raise
    except Exception as e:  # noqa: BLE001
        logger.exception("realtime_subscriber_error", error=str(e))
        raise

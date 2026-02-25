"""Tenant-scoped rate limiter using Redis sliding window (Faz D2)."""

from __future__ import annotations

import time
import uuid

import structlog

from alm.config.settings import settings
from alm.shared.infrastructure.cache import get_redis

logger = structlog.get_logger()

KEY_PREFIX = "ratelimit:tenant:"


async def check_sliding_window(
    tenant_id: uuid.UUID,
    *,
    limit: int | None = None,
    window_seconds: int | None = None,
) -> tuple[bool, int]:
    """Sliding window: allow request if count in window < limit. Returns (allowed, retry_after_seconds)."""
    limit = limit if limit is not None else settings.rate_limit_requests_per_minute
    window_seconds = window_seconds if window_seconds is not None else settings.rate_limit_window_seconds
    key = f"{KEY_PREFIX}{tenant_id}"
    now = time.time()
    window_start = now - window_seconds

    r = get_redis()
    pipe = r.pipeline()
    # Remove entries outside the window (score < window_start)
    pipe.zremrangebyscore(key, "-inf", window_start)
    pipe.zcard(key)
    res = await pipe.execute()
    count = res[1] or 0

    if count >= limit:
        # Get oldest timestamp in window to compute Retry-After
        oldest = await r.zrange(key, 0, 0, withscores=True)
        retry_after = 1
        if oldest:
            oldest_ts = oldest[0][1]
            retry_after = max(1, int(window_seconds - (now - oldest_ts)))
        logger.debug("rate_limit_exceeded", tenant_id=str(tenant_id), count=count, limit=limit)
        return False, retry_after

    pipe = r.pipeline()
    pipe.zadd(key, {str(now): now})
    pipe.expire(key, window_seconds + 10)
    await pipe.execute()
    return True, 0

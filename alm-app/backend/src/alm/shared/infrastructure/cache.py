from __future__ import annotations

import json
import uuid
import redis.asyncio as redis

from alm.config.settings import settings

_pool: redis.ConnectionPool | None = None


def _get_pool() -> redis.ConnectionPool:
    global _pool
    if _pool is None:
        _pool = redis.ConnectionPool.from_url(settings.redis_url, decode_responses=True)
    return _pool


def get_redis() -> redis.Redis:
    return redis.Redis(connection_pool=_get_pool())


class PermissionCache:
    """Redis-backed cache for user permission resolution.

    Key pattern: perm:{tenant_id}:{user_id}
    Value: JSON list of privilege codes
    TTL: 5 minutes
    """

    TTL_SECONDS = 300

    def __init__(self, r: redis.Redis | None = None) -> None:
        self._redis = r or get_redis()

    @staticmethod
    def _key(tenant_id: uuid.UUID, user_id: uuid.UUID) -> str:
        return f"perm:{tenant_id}:{user_id}"

    async def get(self, tenant_id: uuid.UUID, user_id: uuid.UUID) -> list[str] | None:
        """Return cached privilege codes, or None if cache miss."""
        data = await self._redis.get(self._key(tenant_id, user_id))
        if data is None:
            return None
        return json.loads(data)

    async def set(
        self, tenant_id: uuid.UUID, user_id: uuid.UUID, codes: list[str]
    ) -> None:
        await self._redis.set(
            self._key(tenant_id, user_id),
            json.dumps(codes),
            ex=self.TTL_SECONDS,
        )

    async def invalidate_user(self, tenant_id: uuid.UUID, user_id: uuid.UUID) -> None:
        await self._redis.delete(self._key(tenant_id, user_id))

    async def invalidate_tenant(self, tenant_id: uuid.UUID) -> None:
        """Invalidate all cached permissions for a tenant."""
        pattern = f"perm:{tenant_id}:*"
        cursor = 0
        while True:
            cursor, keys = await self._redis.scan(cursor, match=pattern, count=100)
            if keys:
                await self._redis.delete(*keys)
            if cursor == 0:
                break

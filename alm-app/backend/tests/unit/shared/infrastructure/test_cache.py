from __future__ import annotations

import json
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from alm.shared.infrastructure import cache as cache_module
from alm.shared.infrastructure.cache import PermissionCache, _get_pool, get_redis


class TestConnectionPoolHelpers:
    def setup_method(self) -> None:
        cache_module._pool = None

    def teardown_method(self) -> None:
        cache_module._pool = None

    def test_get_pool_creates_once_and_reuses(self) -> None:
        fake_pool = SimpleNamespace(name="pool")
        with (
            patch("alm.shared.infrastructure.cache.settings.redis_url", "redis://localhost:6379/9"),
            patch("alm.shared.infrastructure.cache.redis.ConnectionPool.from_url", return_value=fake_pool) as from_url,
        ):
            first = _get_pool()
            second = _get_pool()

        assert first is fake_pool
        assert second is fake_pool
        from_url.assert_called_once_with("redis://localhost:6379/9", decode_responses=True)

    def test_get_redis_uses_pool(self) -> None:
        fake_pool = SimpleNamespace(name="pool")
        fake_redis = SimpleNamespace(name="redis")
        with (
            patch("alm.shared.infrastructure.cache._get_pool", return_value=fake_pool),
            patch("alm.shared.infrastructure.cache.redis.Redis", return_value=fake_redis) as redis_ctor,
        ):
            client = get_redis()

        assert client is fake_redis
        redis_ctor.assert_called_once_with(connection_pool=fake_pool)


class TestPermissionCache:
    @pytest.mark.asyncio
    async def test_get_returns_none_on_cache_miss(self) -> None:
        r = AsyncMock()
        r.get = AsyncMock(return_value=None)
        cache = PermissionCache(r=r)

        result = await cache.get(uuid.uuid4(), uuid.uuid4())

        assert result is None

    @pytest.mark.asyncio
    async def test_get_returns_deserialized_codes(self) -> None:
        tenant_id = uuid.uuid4()
        user_id = uuid.uuid4()
        r = AsyncMock()
        r.get = AsyncMock(return_value='["artifact:read","artifact:update"]')
        cache = PermissionCache(r=r)

        result = await cache.get(tenant_id, user_id)

        assert result == ["artifact:read", "artifact:update"]
        r.get.assert_awaited_once_with(f"perm:{tenant_id}:{user_id}")

    @pytest.mark.asyncio
    async def test_set_serializes_with_ttl(self) -> None:
        tenant_id = uuid.uuid4()
        user_id = uuid.uuid4()
        r = AsyncMock()
        r.set = AsyncMock(return_value=True)
        cache = PermissionCache(r=r)

        await cache.set(tenant_id, user_id, ["a", "b"])

        r.set.assert_awaited_once_with(
            f"perm:{tenant_id}:{user_id}",
            json.dumps(["a", "b"]),
            ex=PermissionCache.TTL_SECONDS,
        )

    @pytest.mark.asyncio
    async def test_invalidate_user_deletes_single_key(self) -> None:
        tenant_id = uuid.uuid4()
        user_id = uuid.uuid4()
        r = AsyncMock()
        r.delete = AsyncMock(return_value=1)
        cache = PermissionCache(r=r)

        await cache.invalidate_user(tenant_id, user_id)

        r.delete.assert_awaited_once_with(f"perm:{tenant_id}:{user_id}")

    @pytest.mark.asyncio
    async def test_invalidate_tenant_scans_until_cursor_zero(self) -> None:
        tenant_id = uuid.uuid4()
        r = AsyncMock()
        r.scan = AsyncMock(
            side_effect=[
                (7, ["perm:tenant:user1", "perm:tenant:user2"]),
                (0, ["perm:tenant:user3"]),
            ]
        )
        r.delete = AsyncMock(return_value=3)
        cache = PermissionCache(r=r)

        await cache.invalidate_tenant(tenant_id)

        pattern = f"perm:{tenant_id}:*"
        assert r.scan.await_count == 2
        r.scan.assert_any_await(0, match=pattern, count=100)
        r.scan.assert_any_await(7, match=pattern, count=100)
        r.delete.assert_any_await("perm:tenant:user1", "perm:tenant:user2")
        r.delete.assert_any_await("perm:tenant:user3")

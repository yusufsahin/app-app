from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from alm.shared.infrastructure.rate_limiter import check_sliding_window


class _Pipe:
    def __init__(self, execute_result: list[object]) -> None:
        self.execute_result = execute_result
        self.calls: list[tuple[str, tuple[object, ...], dict[str, object]]] = []

    def zremrangebyscore(self, *args: object, **kwargs: object) -> None:
        self.calls.append(("zremrangebyscore", args, kwargs))

    def zcard(self, *args: object, **kwargs: object) -> None:
        self.calls.append(("zcard", args, kwargs))

    def zadd(self, *args: object, **kwargs: object) -> None:
        self.calls.append(("zadd", args, kwargs))

    def expire(self, *args: object, **kwargs: object) -> None:
        self.calls.append(("expire", args, kwargs))

    async def execute(self) -> list[object]:
        return self.execute_result


@pytest.mark.asyncio
async def test_check_sliding_window_allows_and_records_request() -> None:
    tenant_id = uuid.uuid4()
    first_pipe = _Pipe([None, 2])
    second_pipe = _Pipe([None, None])
    redis_client = SimpleNamespace(
        pipeline=lambda: [first_pipe, second_pipe].pop(0),
        zrange=AsyncMock(),
    )
    pipes = [first_pipe, second_pipe]
    redis_client.pipeline = lambda: pipes.pop(0)

    with (
        patch("alm.shared.infrastructure.rate_limiter.get_redis", return_value=redis_client),
        patch("alm.shared.infrastructure.rate_limiter.time.time", return_value=100.0),
    ):
        allowed, retry_after = await check_sliding_window(tenant_id, limit=3, window_seconds=60)

    assert allowed is True
    assert retry_after == 0
    assert [call[0] for call in first_pipe.calls] == ["zremrangebyscore", "zcard"]
    assert [call[0] for call in second_pipe.calls] == ["zadd", "expire"]
    redis_client.zrange.assert_not_awaited()


@pytest.mark.asyncio
async def test_check_sliding_window_blocks_and_uses_oldest_score_for_retry_after() -> None:
    tenant_id = uuid.uuid4()
    first_pipe = _Pipe([None, 3])
    redis_client = SimpleNamespace(
        pipeline=lambda: first_pipe,
        zrange=AsyncMock(return_value=[("90.0", 90.0)]),
    )

    with (
        patch("alm.shared.infrastructure.rate_limiter.get_redis", return_value=redis_client),
        patch("alm.shared.infrastructure.rate_limiter.time.time", return_value=100.0),
    ):
        allowed, retry_after = await check_sliding_window(tenant_id, limit=3, window_seconds=60)

    assert allowed is False
    assert retry_after == 50
    redis_client.zrange.assert_awaited_once()


@pytest.mark.asyncio
async def test_check_sliding_window_uses_minimum_retry_after_when_no_oldest() -> None:
    tenant_id = uuid.uuid4()
    first_pipe = _Pipe([None, 99])
    redis_client = SimpleNamespace(
        pipeline=lambda: first_pipe,
        zrange=AsyncMock(return_value=[]),
    )

    with (
        patch("alm.shared.infrastructure.rate_limiter.get_redis", return_value=redis_client),
        patch("alm.shared.infrastructure.rate_limiter.time.time", return_value=100.0),
    ):
        allowed, retry_after = await check_sliding_window(tenant_id, limit=1, window_seconds=60)

    assert allowed is False
    assert retry_after == 1


@pytest.mark.asyncio
async def test_check_sliding_window_clamps_retry_after_to_minimum_one() -> None:
    tenant_id = uuid.uuid4()
    first_pipe = _Pipe([None, 5])
    redis_client = SimpleNamespace(
        pipeline=lambda: first_pipe,
        zrange=AsyncMock(return_value=[("39.9", 39.9)]),
    )

    with (
        patch("alm.shared.infrastructure.rate_limiter.get_redis", return_value=redis_client),
        patch("alm.shared.infrastructure.rate_limiter.time.time", return_value=100.0),
    ):
        allowed, retry_after = await check_sliding_window(tenant_id, limit=5, window_seconds=60)

    assert allowed is False
    assert retry_after == 1

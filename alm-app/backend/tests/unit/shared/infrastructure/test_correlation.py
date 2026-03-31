from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from starlette.requests import Request
from starlette.responses import Response

from alm.shared.infrastructure.correlation import (
    CORRELATION_ID_HEADER,
    CorrelationIdMiddleware,
    get_correlation_id,
)


def _request(path: str, correlation_id: str | None = None) -> Request:
    headers: list[tuple[bytes, bytes]] = []
    if correlation_id is not None:
        headers.append((CORRELATION_ID_HEADER.lower().encode("utf-8"), correlation_id.encode("utf-8")))
    scope = {
        "type": "http",
        "http_version": "1.1",
        "method": "GET",
        "path": path,
        "headers": headers,
        "query_string": b"",
        "client": ("127.0.0.1", 50000),
        "server": ("testserver", 80),
        "scheme": "http",
    }
    return Request(scope)


async def _ok_response(_: Request) -> Response:
    return Response(content="ok", status_code=200)


class TestCorrelationMiddleware:
    @pytest.mark.asyncio
    async def test_uses_existing_correlation_id_header(self) -> None:
        middleware = CorrelationIdMiddleware(app=AsyncMock())
        request = _request("/health", correlation_id="cid-123")

        with patch("structlog.contextvars.bind_contextvars") as bind_ctx, patch(
            "structlog.contextvars.unbind_contextvars"
        ) as unbind_ctx:
            response = await middleware.dispatch(request, AsyncMock(side_effect=_ok_response))

        assert response.status_code == 200
        assert response.headers[CORRELATION_ID_HEADER] == "cid-123"
        assert get_correlation_id() == "cid-123"
        bind_ctx.assert_called_once_with(correlation_id="cid-123")
        unbind_ctx.assert_called_once_with("correlation_id")

    @pytest.mark.asyncio
    async def test_generates_correlation_id_when_missing(self) -> None:
        middleware = CorrelationIdMiddleware(app=AsyncMock())
        request = _request("/health")

        generated = str(uuid.uuid4())
        with patch("alm.shared.infrastructure.correlation.uuid.uuid4", return_value=generated):
            response = await middleware.dispatch(request, AsyncMock(side_effect=_ok_response))

        assert response.headers[CORRELATION_ID_HEADER] == generated
        assert get_correlation_id() == generated

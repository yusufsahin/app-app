from __future__ import annotations

from unittest.mock import patch

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from alm.shared.domain.exceptions import ValidationError
from alm.shared.infrastructure.error_handler import register_exception_handlers


@pytest.mark.asyncio
async def test_domain_exception_returns_problem_json() -> None:
    app = FastAPI()
    register_exception_handlers(app)

    @app.get("/boom")
    async def boom() -> None:
        raise ValidationError("bad input")

    with patch("alm.shared.infrastructure.error_handler.get_correlation_id", return_value="cid-1"):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.get("/boom")

    assert res.status_code == 422
    body = res.json()
    assert body["type"] == "https://alm.example.com/errors/validation-error"
    assert body["title"] == "Validation Error"
    assert body["status"] == 422
    assert body["detail"] == "bad input"
    assert body["correlation_id"] == "cid-1"


@pytest.mark.asyncio
async def test_unhandled_exception_hides_detail_when_not_debug() -> None:
    app = FastAPI()
    register_exception_handlers(app)

    @app.get("/crash")
    async def crash() -> None:
        raise RuntimeError("secret details")

    with (
        patch("alm.shared.infrastructure.error_handler.settings.debug", False),
        patch("alm.shared.infrastructure.error_handler.get_correlation_id", return_value="cid-2"),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app, raise_app_exceptions=False),
            base_url="http://test",
        ) as client:
            res = await client.get("/crash")

    assert res.status_code == 500
    body = res.json()
    assert body["detail"] == "An unexpected error occurred."
    assert body["correlation_id"] == "cid-2"


@pytest.mark.asyncio
async def test_unhandled_exception_exposes_detail_when_debug() -> None:
    app = FastAPI()
    register_exception_handlers(app)

    @app.get("/crash")
    async def crash() -> None:
        raise RuntimeError("secret details")

    with (
        patch("alm.shared.infrastructure.error_handler.settings.debug", True),
        patch("alm.shared.infrastructure.error_handler.get_correlation_id", return_value="cid-3"),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app, raise_app_exceptions=False),
            base_url="http://test",
        ) as client:
            res = await client.get("/crash")

    assert res.status_code == 500
    body = res.json()
    assert body["detail"] == "secret details"
    assert body["correlation_id"] == "cid-3"

from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, call, patch

import pytest
from starlette.requests import Request
from starlette.responses import Response

from alm.shared.infrastructure.rate_limit_middleware import RateLimitMiddleware, is_scm_provider_webhook_path
from alm.shared.infrastructure.security.jwt import InvalidTokenError
from alm.shared.infrastructure.security_headers import SecureHeadersMiddleware
from alm.shared.infrastructure.tenant_middleware import TenantContextMiddleware


def _request(path: str, authorization: str | None = None) -> Request:
    headers: list[tuple[bytes, bytes]] = []
    if authorization is not None:
        headers.append((b"authorization", authorization.encode("utf-8")))
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


class TestRateLimitMiddleware:
    def test_is_scm_provider_webhook_path(self) -> None:
        pid = uuid.uuid4()
        base = f"/api/v1/orgs/acme/projects/{pid}"
        assert is_scm_provider_webhook_path(f"{base}/webhooks/github") is True
        assert is_scm_provider_webhook_path(f"{base}/webhooks/gitlab") is True
        assert is_scm_provider_webhook_path(f"{base}/webhooks/github/") is True
        assert is_scm_provider_webhook_path(f"{base}/webhooks/unmatched-events") is False

    @pytest.mark.asyncio
    async def test_bypasses_scm_provider_webhooks_with_bearer(self) -> None:
        """Proxies that forward Authorization must not burn tenant rate limit on webhooks."""
        middleware = RateLimitMiddleware(app=AsyncMock())
        tenant_id = uuid.uuid4()
        pid = uuid.uuid4()
        request = _request(
            f"/api/v1/orgs/acme/projects/{pid}/webhooks/github",
            authorization="Bearer token",
        )
        call_next = AsyncMock(side_effect=_ok_response)

        with (
            patch(
                "alm.shared.infrastructure.rate_limit_middleware.decode_token",
                return_value=SimpleNamespace(tid=tenant_id),
            ) as decode,
            patch(
                "alm.shared.infrastructure.rate_limit_middleware.check_sliding_window",
                new=AsyncMock(),
            ) as check,
        ):
            response = await middleware.dispatch(request, call_next)

        assert response.status_code == 200
        decode.assert_not_called()
        check.assert_not_awaited()
        call_next.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_bypasses_non_api_paths(self) -> None:
        middleware = RateLimitMiddleware(app=AsyncMock())
        request = _request("/health")
        call_next = AsyncMock(side_effect=_ok_response)

        with patch("alm.shared.infrastructure.rate_limit_middleware.check_sliding_window", new=AsyncMock()) as check:
            response = await middleware.dispatch(request, call_next)

        assert response.status_code == 200
        check.assert_not_awaited()
        call_next.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_allows_request_when_no_tenant(self) -> None:
        middleware = RateLimitMiddleware(app=AsyncMock())
        request = _request("/api/v1/projects")
        call_next = AsyncMock(side_effect=_ok_response)

        with patch("alm.shared.infrastructure.rate_limit_middleware.check_sliding_window", new=AsyncMock()) as check:
            response = await middleware.dispatch(request, call_next)

        assert response.status_code == 200
        check.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_returns_429_when_limit_exceeded(self) -> None:
        middleware = RateLimitMiddleware(app=AsyncMock())
        tenant_id = uuid.uuid4()
        request = _request("/api/v1/projects", authorization="Bearer token")

        with (
            patch(
                "alm.shared.infrastructure.rate_limit_middleware.decode_token",
                return_value=SimpleNamespace(tid=tenant_id),
            ),
            patch(
                "alm.shared.infrastructure.rate_limit_middleware.check_sliding_window",
                new=AsyncMock(return_value=(False, 12)),
            ) as check,
        ):
            response = await middleware.dispatch(request, AsyncMock(side_effect=_ok_response))

        assert response.status_code == 429
        assert response.headers["Retry-After"] == "12"
        check.assert_awaited_once_with(tenant_id)

    @pytest.mark.asyncio
    async def test_ignores_invalid_token(self) -> None:
        middleware = RateLimitMiddleware(app=AsyncMock())
        request = _request("/api/v1/projects", authorization="Bearer bad")
        call_next = AsyncMock(side_effect=_ok_response)

        with (
            patch("alm.shared.infrastructure.rate_limit_middleware.decode_token", side_effect=InvalidTokenError("bad")),
            patch("alm.shared.infrastructure.rate_limit_middleware.check_sliding_window", new=AsyncMock()) as check,
        ):
            response = await middleware.dispatch(request, call_next)

        assert response.status_code == 200
        check.assert_not_awaited()


class TestTenantContextMiddleware:
    @pytest.mark.asyncio
    async def test_sets_and_resets_tenant_context(self) -> None:
        middleware = TenantContextMiddleware(app=AsyncMock())
        tenant_id = uuid.uuid4()
        request = _request("/api/v1/tenant", authorization="Bearer token")
        call_next = AsyncMock(side_effect=_ok_response)

        with (
            patch(
                "alm.shared.infrastructure.tenant_middleware.decode_token",
                return_value=SimpleNamespace(tid=tenant_id),
            ),
            patch("alm.shared.infrastructure.tenant_middleware.set_current_tenant_id") as set_tenant,
        ):
            response = await middleware.dispatch(request, call_next)

        assert response.status_code == 200
        assert set_tenant.call_args_list == [call(tenant_id), call(None)]

    @pytest.mark.asyncio
    async def test_resets_context_even_when_handler_fails(self) -> None:
        middleware = TenantContextMiddleware(app=AsyncMock())
        tenant_id = uuid.uuid4()
        request = _request("/api/v1/tenant", authorization="Bearer token")
        call_next = AsyncMock(side_effect=RuntimeError("boom"))

        with (
            patch(
                "alm.shared.infrastructure.tenant_middleware.decode_token",
                return_value=SimpleNamespace(tid=tenant_id),
            ),
            patch("alm.shared.infrastructure.tenant_middleware.set_current_tenant_id") as set_tenant,
        ):
            with pytest.raises(RuntimeError, match="boom"):
                await middleware.dispatch(request, call_next)

        assert set_tenant.call_args_list == [call(tenant_id), call(None)]

    @pytest.mark.asyncio
    async def test_ignores_invalid_token(self) -> None:
        middleware = TenantContextMiddleware(app=AsyncMock())
        request = _request("/api/v1/tenant", authorization="Bearer bad")

        with (
            patch("alm.shared.infrastructure.tenant_middleware.decode_token", side_effect=InvalidTokenError("bad")),
            patch("alm.shared.infrastructure.tenant_middleware.set_current_tenant_id") as set_tenant,
        ):
            response = await middleware.dispatch(request, AsyncMock(side_effect=_ok_response))

        assert response.status_code == 200
        assert set_tenant.call_args_list == [call(None), call(None)]


class TestSecureHeadersMiddleware:
    @pytest.mark.asyncio
    async def test_adds_base_security_headers(self) -> None:
        middleware = SecureHeadersMiddleware(app=AsyncMock())
        request = _request("/")

        with patch("alm.shared.infrastructure.security_headers.settings.environment", "development"):
            response = await middleware.dispatch(request, AsyncMock(side_effect=_ok_response))

        assert response.headers["Content-Security-Policy"].startswith("default-src 'self'")
        assert response.headers["X-Frame-Options"] == "DENY"
        assert response.headers["X-Content-Type-Options"] == "nosniff"
        assert response.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"
        assert response.headers["Cross-Origin-Opener-Policy"] == "same-origin"
        assert "Strict-Transport-Security" not in response.headers

    @pytest.mark.asyncio
    async def test_adds_hsts_in_production(self) -> None:
        middleware = SecureHeadersMiddleware(app=AsyncMock())
        request = _request("/")

        with patch("alm.shared.infrastructure.security_headers.settings.environment", "production"):
            response = await middleware.dispatch(request, AsyncMock(side_effect=_ok_response))

        assert response.headers["Strict-Transport-Security"] == "max-age=31536000; includeSubDomains"

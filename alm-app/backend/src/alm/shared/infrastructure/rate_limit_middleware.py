"""Middleware: tenant rate limit (Redis sliding window). Returns 429 + Retry-After when exceeded (Faz D2)."""

from __future__ import annotations

import uuid

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from alm.shared.infrastructure.rate_limiter import check_sliding_window
from alm.shared.infrastructure.security.jwt import InvalidTokenError, decode_token

API_PREFIX = "/api/v1"


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Apply sliding-window rate limit per tenant for /api/v1 requests. No limit when tenant cannot be determined."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if not request.url.path.startswith(API_PREFIX):
            return await call_next(request)

        tenant_id: uuid.UUID | None = None
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            try:
                payload = decode_token(auth_header[7:])
                if payload.tid is not None:
                    tenant_id = payload.tid
            except InvalidTokenError:
                pass

        if tenant_id is None:
            return await call_next(request)

        allowed, retry_after = await check_sliding_window(tenant_id)
        if not allowed:
            return JSONResponse(
                status_code=429,
                headers={"Retry-After": str(retry_after)},
                content={
                    "type": "https://alm.example.com/errors/rate-limit-exceeded",
                    "title": "Rate Limit Exceeded",
                    "status": 429,
                    "detail": "Too many requests. Retry after the number of seconds in Retry-After header.",
                    "retry_after": retry_after,
                },
                media_type="application/problem+json",
            )

        return await call_next(request)

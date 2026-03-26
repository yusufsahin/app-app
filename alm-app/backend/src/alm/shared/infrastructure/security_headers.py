"""Middleware: Secure HTTP headers for production hardening."""

from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from alm.config.settings import settings


class SecureHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)

        # HSTS (Strict-Transport-Security) - only in production/https
        if settings.is_production:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        # CSP (Content-Security-Policy) - basic restrictive policy
        # In actual prod, this should be tuned per route if needed
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "img-src 'self' data:; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "frame-ancestors 'none'; "
            "form-action 'self';"
        )

        # Anti-clickjacking
        response.headers["X-Frame-Options"] = "DENY"

        # Prevent MIME-type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Referrer policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Cross-Origin Opener/Embedder Policy (COOP/COEP) for safer multi-threading if needed
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin"

        return response

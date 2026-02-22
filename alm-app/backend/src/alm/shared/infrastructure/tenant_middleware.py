from __future__ import annotations

import uuid

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from alm.shared.infrastructure.db.tenant_context import set_current_tenant_id
from alm.shared.infrastructure.security.jwt import InvalidTokenError, decode_token


class TenantContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        tenant_id: uuid.UUID | None = None
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            try:
                payload = decode_token(auth_header[7:])
                if payload.tid is not None:
                    tenant_id = payload.tid
            except InvalidTokenError:
                pass

        set_current_tenant_id(tenant_id)
        try:
            return await call_next(request)
        finally:
            set_current_tenant_id(None)

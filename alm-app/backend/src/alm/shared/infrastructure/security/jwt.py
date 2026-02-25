from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

from jose import JWTError, jwt  # type: ignore[import-untyped]

from alm.config.settings import settings
from alm.shared.domain.ports import ITokenService


class InvalidTokenError(Exception):
    pass


class JwtTokenService(ITokenService):
    """ITokenService implementation using JWT."""

    def create_access_token(self, user_id: uuid.UUID, tenant_id: uuid.UUID, roles: list[str]) -> str:
        return create_access_token(user_id=user_id, tenant_id=tenant_id, roles=roles)

    def create_refresh_token_value(self) -> str:
        return create_refresh_token_value()

    def create_temp_token(self, user_id: uuid.UUID) -> str:
        return create_temp_token(user_id)


@dataclass(frozen=True)
class TokenPayload:
    sub: uuid.UUID
    tid: uuid.UUID | None = None
    roles: list[str] = field(default_factory=list)
    token_type: str = "access"


def create_access_token(
    user_id: uuid.UUID,
    tenant_id: uuid.UUID,
    roles: list[str],
) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "tid": str(tenant_id),
        "roles": roles,
        "type": "access",
        "exp": now + timedelta(minutes=settings.jwt_access_token_expire_minutes),
        "iat": now,
    }
    return str(jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm))


def create_temp_token(user_id: uuid.UUID) -> str:
    """Short-lived token for tenant selection when user has multiple tenants."""
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "type": "tenant_select",
        "exp": now + timedelta(minutes=5),
        "iat": now,
    }
    return str(jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm))


def create_refresh_token_value() -> str:
    return uuid.uuid4().hex + uuid.uuid4().hex


def decode_token(token: str) -> TokenPayload:
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        return TokenPayload(
            sub=uuid.UUID(payload["sub"]),
            tid=uuid.UUID(payload["tid"]) if payload.get("tid") else None,
            roles=payload.get("roles", []),
            token_type=payload.get("type", "access"),
        )
    except (JWTError, KeyError, ValueError) as exc:
        raise InvalidTokenError(str(exc)) from exc

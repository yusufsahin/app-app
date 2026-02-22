from collections.abc import AsyncGenerator

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from alm.shared.application.mediator import Mediator
from alm.shared.audit.interceptor import ACTOR_ID_KEY, TENANT_ID_KEY
from alm.shared.infrastructure.db.session import async_session_factory
from alm.shared.infrastructure.security.jwt import InvalidTokenError, decode_token

_optional_bearer = HTTPBearer(auto_error=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_mediator(
    credentials: HTTPAuthorizationCredentials | None = Depends(_optional_bearer),
) -> AsyncGenerator[Mediator, None]:
    """Request-scoped Mediator. Commands auto-commit via Mediator.send().

    Automatically injects actor/tenant context from the bearer token
    (when present) so the audit interceptor can attribute changes.
    """
    async with async_session_factory() as session:
        if credentials is not None:
            try:
                payload = decode_token(credentials.credentials)
                session.info[ACTOR_ID_KEY] = payload.sub
                if payload.tid is not None:
                    session.info[TENANT_ID_KEY] = payload.tid
            except InvalidTokenError:
                pass
        yield Mediator(session)

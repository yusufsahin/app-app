from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession

from alm.shared.application.mediator import Mediator
from alm.shared.infrastructure.db.session import async_session_factory


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_mediator() -> AsyncGenerator[Mediator, None]:
    """Request-scoped Mediator. Commands auto-commit via Mediator.send()."""
    async with async_session_factory() as session:
        yield Mediator(session)

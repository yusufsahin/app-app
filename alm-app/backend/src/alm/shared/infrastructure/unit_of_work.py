"""Unit of Work implementation — SQLAlchemy adapter."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from alm.shared.domain.unit_of_work import IUnitOfWork


class SqlAlchemyUnitOfWork(IUnitOfWork):
    """Unit of Work wrapping AsyncSession. Session lifecycle managed by caller."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def commit(self) -> None:
        await self._session.commit()

    async def rollback(self) -> None:
        await self._session.rollback()

    @property
    def session(self) -> AsyncSession:
        return self._session

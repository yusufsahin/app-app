from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from alm.shared.infrastructure.unit_of_work import SqlAlchemyUnitOfWork


@pytest.mark.asyncio
async def test_commit_calls_session_commit() -> None:
    session = AsyncMock()
    uow = SqlAlchemyUnitOfWork(session)

    await uow.commit()

    session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_rollback_calls_session_rollback() -> None:
    session = AsyncMock()
    uow = SqlAlchemyUnitOfWork(session)

    await uow.rollback()

    session.rollback.assert_awaited_once()


def test_session_property_exposes_underlying_session() -> None:
    session = AsyncMock()
    uow = SqlAlchemyUnitOfWork(session)

    assert uow.session is session

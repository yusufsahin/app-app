import asyncio
from collections.abc import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from alm.shared.infrastructure.db.base_model import Base
import alm.auth.infrastructure.models  # noqa: F401
import alm.tenant.infrastructure.models  # noqa: F401
import alm.shared.audit.models  # noqa: F401

TEST_DATABASE_URL = "postgresql+asyncpg://alm:alm_dev_password@localhost:5432/alm_test"


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def test_engine():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture(scope="session")
def test_session_factory(test_engine):
    return async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture
async def db_session(test_session_factory) -> AsyncGenerator[AsyncSession, None]:
    async with test_session_factory() as session:
        yield session
        await session.rollback()


@pytest.fixture(scope="session")
async def client(test_engine, test_session_factory) -> AsyncGenerator[AsyncClient, None]:
    import alm.shared.infrastructure.db.session as session_mod
    import alm.config.dependencies as deps_mod  # noqa: F401

    original_factory = session_mod.async_session_factory
    session_mod.async_session_factory = test_session_factory

    from alm.main import create_app
    app = create_app()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    session_mod.async_session_factory = original_factory

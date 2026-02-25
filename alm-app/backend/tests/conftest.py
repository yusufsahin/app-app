"""Pytest configuration and fixtures for ALM backend.

Integration tests use PostgreSQL. Either: test container (Docker), ALM_TEST_DATABASE_URL, or local alm_test.
"""

from __future__ import annotations

import os
import uuid
from collections.abc import AsyncGenerator, Generator
from unittest.mock import patch
from urllib.parse import urlparse

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

import alm.admin.infrastructure.models  # noqa: F401
import alm.area.infrastructure.models  # noqa: F401
import alm.artifact.infrastructure.models  # noqa: F401
import alm.artifact_link.infrastructure.models  # noqa: F401
import alm.attachment.infrastructure.models  # noqa: F401
import alm.auth.infrastructure.models  # noqa: F401
import alm.comment.infrastructure.models  # noqa: F401
import alm.cycle.infrastructure.models  # noqa: F401
import alm.process_template.infrastructure.models  # noqa: F401
import alm.project.infrastructure.models  # noqa: F401
import alm.project.infrastructure.project_member_models  # noqa: F401
import alm.saved_query.infrastructure.models  # noqa: F401
import alm.shared.audit.models  # noqa: F401
import alm.task.infrastructure.models  # noqa: F401
import alm.team.infrastructure.models  # noqa: F401
import alm.tenant.infrastructure.models  # noqa: F401
import alm.workflow_rule.infrastructure.models  # noqa: F401
from alm.shared.infrastructure.db.base_model import Base

_TEST_DB_URL_ENV = os.environ.get("ALM_TEST_DATABASE_URL", "").strip()
_USE_TEST_CONTAINER = os.environ.get("ALM_USE_TEST_CONTAINER", "1").strip().lower() in ("1", "true", "yes")
_DEFAULT_LOCAL_URL = "postgresql+asyncpg://alm:alm_dev_password@localhost:5432/alm_test"


def _asyncpg_url(url: str) -> str:
    """Ensure URL uses asyncpg driver for SQLAlchemy."""
    if "+asyncpg" in url:
        return url
    if "postgresql+psycopg2" in url:
        return url.replace("postgresql+psycopg2", "postgresql+asyncpg", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


def _ensure_local_test_db(url: str) -> None:
    """Create alm_test database on local Postgres if missing (uses psycopg2). No-op on failure."""
    parsed = urlparse(url.replace("postgresql+asyncpg://", "postgresql://"))
    db_name = (parsed.path or "/alm_test").strip("/") or "alm_test"
    user = parsed.username or "alm"
    host = parsed.hostname or "localhost"
    port = parsed.port or 5432
    password = parsed.password or "alm_dev_password"
    try:
        import psycopg2

        conn = psycopg2.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            database="postgres",
            connect_timeout=3,
        )
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (db_name,))
        if cur.fetchone() is None:
            cur.execute(f'CREATE DATABASE "{db_name}"')
        cur.close()
        conn.close()
    except Exception:
        pass


@pytest.fixture(scope="session")
def postgres_url() -> Generator[str, None, None]:
    """Session-scoped PostgreSQL URL. Prefer: ALM_TEST_DATABASE_URL → test container → local alm_test."""
    if _TEST_DB_URL_ENV:
        yield _asyncpg_url(_TEST_DB_URL_ENV)
        return

    # 1) Try test container (Docker) - same image as CI for parity
    if _USE_TEST_CONTAINER:
        try:
            from testcontainers.postgres import PostgresContainer

            container = PostgresContainer("postgres:16-alpine")
            container.start()
            try:
                url = container.get_connection_url()
                yield _asyncpg_url(url)
            finally:
                container.stop()
            return
        except ImportError:
            pass
        except Exception:
            pass

    # 2) Fallback: local Postgres (alm_test); create DB if missing
    _ensure_local_test_db(_DEFAULT_LOCAL_URL)
    yield _asyncpg_url(_DEFAULT_LOCAL_URL)


@pytest.fixture(scope="session")
async def test_engine(postgres_url: str):
    """Session-scoped async engine using postgres_url (container or ALM_TEST_DATABASE_URL)."""
    engine = create_async_engine(
        postgres_url,
        echo=False,
        poolclass=NullPool,
        connect_args={"timeout": 10},
    )
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
    except Exception as e:
        await engine.dispose()
        pytest.skip(
            f"PostgreSQL test database unavailable: {e}. Start Docker (see backend/tests/README.md) or set ALM_TEST_DATABASE_URL."
        )

    # Seed privileges and process templates so provision_tenant and artifact creation work
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    try:
        from alm.config.seed import seed_privileges, seed_process_templates

        await seed_privileges(session_factory)
        await seed_process_templates(session_factory)
    except Exception:
        pass

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


class _FakePermissionCache:
    """Permission cache that always misses so integration tests always read from DB (no Redis)."""

    async def get(self, tenant_id: uuid.UUID, user_id: uuid.UUID) -> list[str] | None:
        return None

    async def set(self, tenant_id: uuid.UUID, user_id: uuid.UUID, codes: list[str]) -> None:
        pass

    async def invalidate_user(self, tenant_id: uuid.UUID, user_id: uuid.UUID) -> None:
        pass

    async def invalidate_tenant(self, tenant_id: uuid.UUID) -> None:
        pass


async def _noop_subscriber() -> None:
    """No-op so integration tests don't start Redis subscriber (avoids Event loop is closed)."""
    return


@pytest.fixture
async def client(test_engine, test_session_factory) -> AsyncGenerator[AsyncClient, None]:
    import alm.shared.infrastructure.db.session as session_mod

    original_factory = session_mod.async_session_factory
    session_mod.async_session_factory = test_session_factory

    with (
        patch(
            "alm.shared.infrastructure.cache.PermissionCache",
            _FakePermissionCache,
        ),
        patch("alm.main.run_subscriber", _noop_subscriber),
    ):
        from alm.main import create_app

        app = create_app()

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac

    session_mod.async_session_factory = original_factory

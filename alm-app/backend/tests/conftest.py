"""Pytest configuration and fixtures for ALM backend.

Integration tests use PostgreSQL. Either: test container (Docker), ALM_TEST_DATABASE_URL, or local alm_test.

Unit-test seed data: reuse ``tests.support.manifests`` (manifest bundles) and
``tests.support.mocks`` (e.g. ``empty_project_tag_repo``, ``simple_manifest_ast``) instead of copying dicts.

Minimal FastAPI apps in unit tests should call ``register_exception_handlers(app)`` when asserting
HTTP status codes for ``DomainException`` subclasses (e.g. ``AccessDenied`` → 403).
"""

from __future__ import annotations

import os

# Policy/ACL fallback when MPC is not installed (CI / minimal env); production still uses strict via ALM_ENVIRONMENT.
os.environ.setdefault("ALM_MPC_MODE", "degraded")
import uuid
from collections.abc import AsyncGenerator, Generator
from contextlib import ExitStack
from unittest.mock import AsyncMock, patch
from urllib.parse import urlparse

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

import alm.admin.infrastructure.models
import alm.area.infrastructure.models
import alm.artifact.infrastructure.models
import alm.attachment.infrastructure.models
import alm.auth.infrastructure.models
import alm.capacity.infrastructure.models
import alm.comment.infrastructure.models
import alm.cycle.infrastructure.models
import alm.deployment.infrastructure.models
import alm.process_template.infrastructure.models
import alm.project.infrastructure.models
import alm.project.infrastructure.project_member_models
import alm.project_tag.infrastructure.models
import alm.relationship.infrastructure.models
import alm.report_definition.infrastructure.models
import alm.saved_query.infrastructure.models
import alm.scm.infrastructure.models
import alm.shared.audit.models
import alm.shared.infrastructure.domain_event_outbox
import alm.task.infrastructure.models
import alm.team.infrastructure.models
import alm.tenant.infrastructure.models
import alm.workflow_rule.infrastructure.models  # noqa: F401 — ORM side effect (table metadata)
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
            return  # noqa: TRY300 — generator fixture: stop container then exit branch
        except ImportError:
            pass
        except Exception:
            pass

    # 2) Fallback: local Postgres (alm_test); create DB if missing
    _ensure_local_test_db(_DEFAULT_LOCAL_URL)
    yield _asyncpg_url(_DEFAULT_LOCAL_URL)


@pytest_asyncio.fixture(scope="session")
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
            f"PostgreSQL test database unavailable: {e}. "
            "Start Docker (see backend/tests/README.md) or set ALM_TEST_DATABASE_URL."
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
    # Avoid async teardown that touches the engine: pytest-asyncio may run session teardown while other
    # collected tests still need this engine, which led to UndefinedTableError mid-suite. Tables are wiped
    # at the next session setup (drop_all/create_all). Process exit closes remaining connections.


@pytest.fixture(scope="session")
def test_session_factory(test_engine):
    return async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture
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


async def _noop_domain_event_outbox_worker(_session_factory: object) -> None:
    """No-op so integration tests don't run the outbox polling loop."""
    return


async def _noop_publish_event(_tenant_id: uuid.UUID, _payload: dict[str, object]) -> None:
    """No-op so integration tests do not wait on Redis realtime publish calls."""
    return


# ``from session import async_session_factory`` binds the factory at import time in each module below.
# Patching only ``alm.shared.infrastructure.db.session`` leaves stale references → requests hit prod URL / wrong DB.
_ASYNC_SESSION_FACTORY_PATCH_TARGETS: tuple[str, ...] = (
    "alm.shared.infrastructure.db.session.async_session_factory",
    "alm.config.dependencies.async_session_factory",
    "alm.main.async_session_factory",
    "alm.workflow_rule.infrastructure.workflow_rule_runner.async_session_factory",
    "alm.realtime.event_handlers.async_session_factory",
    "alm.admin.infrastructure.access_audit_store.async_session_factory",
    # Event handlers that open their own DB sessions must also be patched.
    "alm.artifact.application.stale_traceability_side_effects.async_session_factory",
    # Routes that bind async_session_factory at import time must be patched too if any test
    # imports them before the client fixture applies the test DB factory.
    "alm.admin.api.router.async_session_factory",
    "alm.orgs.api.routes_deploy_webhook.async_session_factory",
    "alm.orgs.api.routes_github_webhook.async_session_factory",
    "alm.orgs.api.routes_gitlab_webhook.async_session_factory",
    "alm.orgs.api.routes_azuredevops_webhook.async_session_factory",
    "alm.orgs.api.routes_scm_webhook_unmatched.async_session_factory",
)


@pytest_asyncio.fixture
async def client(test_engine, test_session_factory) -> AsyncGenerator[AsyncClient, None]:
    with ExitStack() as stack:
        for target in _ASYNC_SESSION_FACTORY_PATCH_TARGETS:
            stack.enter_context(patch(target, test_session_factory))
        stack.enter_context(
            patch(
                "alm.shared.infrastructure.cache.PermissionCache",
                _FakePermissionCache,
            )
        )
        stack.enter_context(patch("alm.main.run_subscriber", _noop_subscriber))
        stack.enter_context(patch("alm.main.run_domain_event_outbox_worker", _noop_domain_event_outbox_worker))
        # Rate limit middleware uses Redis; integration tests run without Redis by default.
        stack.enter_context(
            patch(
                "alm.shared.infrastructure.rate_limit_middleware.check_sliding_window",
                new_callable=AsyncMock,
                return_value=(True, 0),
            )
        )
        stack.enter_context(patch("alm.realtime.event_handlers.publish_event", _noop_publish_event))

        from alm.main import create_app

        app = create_app()

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac

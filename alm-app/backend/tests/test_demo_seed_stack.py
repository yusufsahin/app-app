"""Full startup seed + API checks on an isolated database.

Uses a dedicated database name on the same Postgres instance as other integration tests
(`alm_demo_seed_e2e`) so `run_startup_seeds` always sees an empty demo world even when
`tests/conftest.py` session DB already has data from other tests.

Run with PostgreSQL available (compose test DB, testcontainers, or ALM_TEST_DATABASE_URL).
"""

from __future__ import annotations

import logging
from contextlib import ExitStack
from unittest.mock import AsyncMock, patch
from urllib.parse import urlparse

import asyncpg
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.engine.url import make_url
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
from alm.config.seed import DEMO_EMAIL, DEMO_PASSWORD, run_startup_seeds
from alm.config.settings import settings
from alm.shared.infrastructure.db.base_model import Base

_DEMO_ISOLATED_DB = "alm_demo_seed_e2e"

log = logging.getLogger("alm.tests.demo_seed_stack")

_ASYNC_SESSION_FACTORY_PATCH_TARGETS: tuple[str, ...] = (
    "alm.shared.infrastructure.db.session.async_session_factory",
    "alm.config.dependencies.async_session_factory",
    "alm.main.async_session_factory",
    "alm.workflow_rule.infrastructure.workflow_rule_runner.async_session_factory",
    "alm.realtime.event_handlers.async_session_factory",
    "alm.admin.infrastructure.access_audit_store.async_session_factory",
    "alm.artifact.application.stale_traceability_side_effects.async_session_factory",
    "alm.admin.api.router.async_session_factory",
    "alm.orgs.api.routes_deploy_webhook.async_session_factory",
    "alm.orgs.api.routes_github_webhook.async_session_factory",
    "alm.orgs.api.routes_gitlab_webhook.async_session_factory",
    "alm.orgs.api.routes_azuredevops_webhook.async_session_factory",
    "alm.orgs.api.routes_scm_webhook_unmatched.async_session_factory",
)


def _asyncpg_url(url: str) -> str:
    if "+asyncpg" in url:
        return url
    if "postgresql+psycopg2" in url:
        return url.replace("postgresql+psycopg2", "postgresql+asyncpg", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


def _replace_database_in_url(url: str, new_db: str) -> str:
    normalized = _asyncpg_url(url)
    raw = normalized.replace("postgresql+asyncpg://", "postgresql://")
    parsed = urlparse(raw)
    auth = ""
    if parsed.username:
        auth = parsed.username
        if parsed.password:
            auth += f":{parsed.password}"
        auth += "@"
    host = parsed.hostname or "localhost"
    port = f":{parsed.port}" if parsed.port else ""
    return f"postgresql+asyncpg://{auth}{host}{port}/{new_db}"


async def _ensure_database(url: str) -> None:
    """Create isolated DB on the same server (asyncpg only — no psycopg2)."""
    u = make_url(url.replace("postgresql+asyncpg", "postgresql", 1))
    db_name = u.database or _DEMO_ISOLATED_DB
    try:
        conn = await asyncpg.connect(
            user=u.username,
            password=u.password or "",
            host=u.host or "localhost",
            port=u.port or 5432,
            database="postgres",
            timeout=30,
        )
        try:
            row = await conn.fetchrow("SELECT 1 FROM pg_database WHERE datname = $1", db_name)
            if row is None:
                log.info("demo_seed_isolated_db_created database=%s", db_name)
                await conn.execute(f'CREATE DATABASE "{db_name}"')
            else:
                log.info("demo_seed_isolated_db_exists database=%s", db_name)
        finally:
            await conn.close()
    except Exception as exc:
        pytest.fail(f"Could not ensure isolated demo DB {db_name!r}: {exc}")


async def _noop_subscriber() -> None:
    return


async def _noop_domain_event_outbox_worker(_session_factory: object) -> None:
    return


class _FakePermissionCache:
    async def get(self, tenant_id, user_id):
        return None

    async def set(self, tenant_id, user_id, codes):
        pass

    async def invalidate_user(self, tenant_id, user_id):
        pass

    async def invalidate_tenant(self, tenant_id):
        pass


@pytest.mark.asyncio
async def test_run_startup_seeds_demo_backlog_end_to_end(postgres_url: str, monkeypatch: pytest.MonkeyPatch) -> None:
    """Empty isolated DB → run_startup_seeds → tree=requirement lists seeded workitems."""
    monkeypatch.setattr(settings, "seed_demo_data", True)
    url = _replace_database_in_url(postgres_url, _DEMO_ISOLATED_DB)
    log.info(
        "demo_seed_stack_start database=%s host=%s",
        _DEMO_ISOLATED_DB,
        url.split("@")[-1].split("/")[0],
    )
    await _ensure_database(url)

    engine = create_async_engine(
        url,
        echo=False,
        poolclass=NullPool,
        connect_args={"timeout": 30},
    )
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
        log.info("demo_seed_stack_schema_ready database=%s", _DEMO_ISOLATED_DB)

        session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        await run_startup_seeds(session_factory)
        log.info("demo_seed_stack_run_startup_seeds_done database=%s", _DEMO_ISOLATED_DB)

        with ExitStack() as stack:
            for target in _ASYNC_SESSION_FACTORY_PATCH_TARGETS:
                stack.enter_context(patch(target, session_factory))
            stack.enter_context(
                patch(
                    "alm.shared.infrastructure.cache.PermissionCache",
                    _FakePermissionCache,
                )
            )
            stack.enter_context(patch("alm.main.run_subscriber", _noop_subscriber))
            stack.enter_context(patch("alm.main.run_domain_event_outbox_worker", _noop_domain_event_outbox_worker))
            stack.enter_context(
                patch(
                    "alm.shared.infrastructure.rate_limit_middleware.check_sliding_window",
                    new_callable=AsyncMock,
                    return_value=(True, 0),
                )
            )

            from alm.main import create_app

            app = create_app()
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                login = await ac.post(
                    "/api/v1/auth/login",
                    json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD},
                )
                assert login.status_code == 200, login.text
                body = login.json()
                assert body.get("access_token"), body
                token = body["access_token"]
                headers = {"Authorization": f"Bearer {token}"}
                log.info("demo_seed_stack_login_ok email=%s", DEMO_EMAIL)

                projects_r = await ac.get("/api/v1/orgs/demo/projects", headers=headers)
                assert projects_r.status_code == 200, projects_r.text
                projects = projects_r.json()
                slugs = {p["slug"] for p in projects}
                assert "sample-project" in slugs
                assert "unima" in slugs

                by_slug = {p["slug"]: p["id"] for p in projects}
                log.info("demo_seed_stack_projects_ok slugs=%s", sorted(slugs))

                for slug in ("sample-project", "unima"):
                    pid = by_slug[slug]
                    roots_r = await ac.get(
                        f"/api/v1/orgs/demo/projects/{pid}/artifacts",
                        headers=headers,
                        params={"include_system_roots": "true"},
                    )
                    roots_r.raise_for_status()
                    types = {a["artifact_type"] for a in roots_r.json()["items"]}
                    assert "root-requirement" in types, f"missing root-requirement for {slug}"

                    backlog_r = await ac.get(
                        f"/api/v1/orgs/demo/projects/{pid}/artifacts",
                        headers=headers,
                        params={"tree": "requirement"},
                    )
                    backlog_r.raise_for_status()
                    data = backlog_r.json()
                    assert data["total"] > 0, f"tree=requirement empty for {slug}"
                    leaf_types = {a["artifact_type"] for a in data["items"]}
                    assert "root-requirement" not in leaf_types
                    assert "workitem" in leaf_types or "epic" in leaf_types, leaf_types
                    log.info(
                        "demo_seed_stack_backlog_ok slug=%s total=%s leaf_types=%s",
                        slug,
                        data["total"],
                        sorted(leaf_types),
                    )
        log.info("demo_seed_stack_complete database=%s", _DEMO_ISOLATED_DB)
    finally:
        await engine.dispose()

"""PostgreSQL integration tests for outbox claim + dispatch (requires test_engine)."""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select

from alm.artifact.domain.events import ArtifactCreated
from alm.config.settings import settings
from alm.shared.infrastructure.domain_event_outbox import (
    DomainEventOutboxModel,
    domain_event_to_payload,
    process_pending_outbox_batch,
    requeue_exhausted_outbox_rows,
)


async def _register_admin_access_token(client: AsyncClient) -> str:
    email = f"outbox-http-{uuid.uuid4().hex[:12]}@example.com"
    reg = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "SecurePass123",
            "display_name": "admin",
            "org_name": f"OutboxOrg-{uuid.uuid4().hex[:8]}",
        },
    )
    reg.raise_for_status()
    return reg.json()["access_token"]


@pytest.mark.asyncio
async def test_worker_dispatch_success_removes_outbox_row(test_session_factory):
    pid = uuid.uuid4()
    aid = uuid.uuid4()
    ev = ArtifactCreated(
        project_id=pid,
        artifact_id=aid,
        artifact_type="planning",
        title="T",
        state="draft",
    )
    packed = domain_event_to_payload(ev)
    row_id = uuid.uuid4()
    async with test_session_factory() as session:
        session.add(
            DomainEventOutboxModel(
                id=row_id,
                event_type=packed["event_type"],
                payload=packed,
            )
        )
        await session.commit()

    dispatcher = AsyncMock()
    with patch(
        "alm.shared.application.mediator.get_domain_event_dispatcher",
        return_value=dispatcher,
    ):
        processed = await process_pending_outbox_batch(test_session_factory)

    assert processed >= 1
    dispatcher.dispatch.assert_awaited()

    async with test_session_factory() as session:
        cnt = await session.scalar(select(func.count()).select_from(DomainEventOutboxModel))
        await session.commit()

    assert cnt == 0


@pytest.mark.asyncio
async def test_worker_dispatch_failure_keeps_row_and_clears_lease(test_session_factory):
    pid = uuid.uuid4()
    aid = uuid.uuid4()
    ev = ArtifactCreated(
        project_id=pid,
        artifact_id=aid,
        artifact_type="planning",
        title="T",
        state="draft",
    )
    packed = domain_event_to_payload(ev)
    row_id = uuid.uuid4()
    async with test_session_factory() as session:
        session.add(
            DomainEventOutboxModel(
                id=row_id,
                event_type=packed["event_type"],
                payload=packed,
            )
        )
        await session.commit()

    dispatcher = AsyncMock()
    dispatcher.dispatch.side_effect = RuntimeError("handler_failed")

    with patch(
        "alm.shared.application.mediator.get_domain_event_dispatcher",
        return_value=dispatcher,
    ):
        await process_pending_outbox_batch(test_session_factory)

    async with test_session_factory() as session:
        row = await session.scalar(select(DomainEventOutboxModel).where(DomainEventOutboxModel.id == row_id))
        await session.commit()

    assert row is not None
    assert row.attempts == 1
    assert row.locked_until is None
    assert row.last_error is not None


@pytest.mark.asyncio
async def test_requeue_exhausted_resets_row_for_retry(test_session_factory):
    pid = uuid.uuid4()
    aid = uuid.uuid4()
    ev = ArtifactCreated(
        project_id=pid,
        artifact_id=aid,
        artifact_type="planning",
        title="T",
        state="draft",
    )
    packed = domain_event_to_payload(ev)
    row_id = uuid.uuid4()
    max_a = settings.domain_event_outbox_max_attempts
    async with test_session_factory() as session:
        session.add(
            DomainEventOutboxModel(
                id=row_id,
                event_type=packed["event_type"],
                payload=packed,
                attempts=max_a,
                last_error="gone",
            )
        )
        await session.commit()

    n = await requeue_exhausted_outbox_rows(test_session_factory, limit=10)
    assert n == 1

    async with test_session_factory() as session:
        row = await session.scalar(select(DomainEventOutboxModel).where(DomainEventOutboxModel.id == row_id))
        await session.commit()

    assert row is not None
    assert row.attempts == 0
    assert row.last_error is None
    assert row.locked_until is None


@pytest.mark.asyncio
async def test_admin_requeue_exhausted_http_requires_auth(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/v1/admin/domain-event-outbox/requeue-exhausted",
        params={"limit": 10},
    )
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_admin_requeue_exhausted_http_forbidden_for_non_admin(client: AsyncClient) -> None:
    admin_token = await _register_admin_access_token(client)
    member_email = f"member-{uuid.uuid4().hex[:12]}@example.com"
    member_password = "SecurePass456"
    create = await client.post(
        "/api/v1/admin/users",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "email": member_email,
            "password": member_password,
            "display_name": "Non-Admin User",
            "role_slug": "member",
        },
    )
    create.raise_for_status()

    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": member_email, "password": member_password},
    )
    login_resp.raise_for_status()
    payload = login_resp.json()
    assert payload.get("requires_tenant_selection") is not True
    member_token = payload["access_token"]
    assert member_token

    resp = await client.post(
        "/api/v1/admin/domain-event-outbox/requeue-exhausted",
        headers={"Authorization": f"Bearer {member_token}"},
        params={"limit": 10},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_admin_requeue_exhausted_via_http(client: AsyncClient, test_session_factory) -> None:
    token = await _register_admin_access_token(client)
    pid = uuid.uuid4()
    aid = uuid.uuid4()
    ev = ArtifactCreated(
        project_id=pid,
        artifact_id=aid,
        artifact_type="planning",
        title="T",
        state="draft",
    )
    packed = domain_event_to_payload(ev)
    row_id = uuid.uuid4()
    max_a = settings.domain_event_outbox_max_attempts
    async with test_session_factory() as session:
        session.add(
            DomainEventOutboxModel(
                id=row_id,
                event_type=packed["event_type"],
                payload=packed,
                attempts=max_a,
                last_error="gone",
            )
        )
        await session.commit()

    resp = await client.post(
        "/api/v1/admin/domain-event-outbox/requeue-exhausted",
        headers={"Authorization": f"Bearer {token}"},
        params={"limit": 10},
    )
    assert resp.status_code == 200
    assert resp.json() == {"requeued": 1}

    async with test_session_factory() as session:
        row = await session.scalar(select(DomainEventOutboxModel).where(DomainEventOutboxModel.id == row_id))
        await session.commit()

    assert row is not None
    assert row.attempts == 0
    assert row.last_error is None
    assert row.locked_until is None

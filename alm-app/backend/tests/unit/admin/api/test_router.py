from __future__ import annotations

import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest

from alm.admin.api.router import (
    CreateUserByAdminRequest,
    create_user,
    delete_user,
    get_access_audit,
    list_users,
)
from alm.shared.infrastructure.security.dependencies import CurrentUser
from alm.tenant.application.commands.create_user_by_admin import CreateUserByAdminResult
from alm.tenant.application.queries.list_users_for_admin import AdminUserSummary, ListUsersForAdmin


class TestAdminRouter:
    @pytest.mark.asyncio
    async def test_list_users_maps_admin_summaries(self) -> None:
        tenant_id = uuid.uuid4()
        user = CurrentUser(id=uuid.uuid4(), tenant_id=tenant_id, roles=["admin"])
        deleted_at = datetime(2026, 3, 1, 12, 0, tzinfo=UTC)
        summaries = [
            AdminUserSummary(
                user_id=uuid.uuid4(),
                email="a@example.com",
                display_name="Alice",
                deleted_at=None,
                role_slugs=["member"],
            ),
            AdminUserSummary(
                user_id=uuid.uuid4(),
                email="d@example.com",
                display_name="Deleted",
                deleted_at=deleted_at,
                role_slugs=["admin"],
            ),
        ]
        mediator = AsyncMock()
        mediator.query = AsyncMock(return_value=summaries)

        result = await list_users(user=user, mediator=mediator, include_deleted=True)

        assert len(result) == 2
        assert result[0].email == "a@example.com"
        assert result[0].deleted_at is None
        assert result[1].deleted_at == deleted_at.isoformat()
        mediator.query.assert_awaited_once_with(ListUsersForAdmin(tenant_id=tenant_id, include_deleted=True))

    @pytest.mark.asyncio
    async def test_create_user_builds_and_sends_command(self) -> None:
        tenant_id = uuid.uuid4()
        admin_id = uuid.uuid4()
        user = CurrentUser(id=admin_id, tenant_id=tenant_id, roles=["admin"])
        body = CreateUserByAdminRequest(
            email="new@example.com",
            password="Passw0rd!",
            display_name="",
            role_slug="member",
        )
        created_user_id = uuid.uuid4()
        mediator = AsyncMock()
        mediator.send = AsyncMock(
            return_value=CreateUserByAdminResult(
                user_id=created_user_id,
                email="new@example.com",
                display_name="new@example.com",
            )
        )

        response = await create_user(body=body, user=user, mediator=mediator)

        assert response.user_id == str(created_user_id)
        assert response.email == "new@example.com"
        assert response.display_name == "new@example.com"

        sent_command = mediator.send.await_args.args[0]
        assert sent_command.tenant_id == tenant_id
        assert sent_command.email == "new@example.com"
        assert sent_command.password == "Passw0rd!"
        assert sent_command.display_name == "new@example.com"
        assert sent_command.role_slug == "member"
        assert sent_command.created_by == admin_id

    @pytest.mark.asyncio
    async def test_delete_user_sends_soft_delete_command(self) -> None:
        tenant_id = uuid.uuid4()
        admin_id = uuid.uuid4()
        target_user_id = uuid.uuid4()
        user = CurrentUser(id=admin_id, tenant_id=tenant_id, roles=["admin"])
        mediator = AsyncMock()
        mediator.send = AsyncMock(return_value=None)

        await delete_user(user_id=target_user_id, user=user, mediator=mediator)

        sent_command = mediator.send.await_args.args[0]
        assert sent_command.tenant_id == tenant_id
        assert sent_command.user_id == target_user_id
        assert sent_command.deleted_by == admin_id

    @pytest.mark.asyncio
    async def test_get_access_audit_parses_valid_dates(self) -> None:
        user = CurrentUser(id=uuid.uuid4(), tenant_id=uuid.uuid4(), roles=["admin"])
        store = AsyncMock()
        expected_payload = [{"id": "1", "type": "LOGIN_SUCCESS"}]
        store.list_entries = AsyncMock(return_value=expected_payload)

        result = await get_access_audit(
            _user=user,
            from_date="2026-03-01T00:00:00Z",
            to_date="2026-03-02T12:30:00Z",
            type_filter="LOGIN_SUCCESS",
            limit=77,
            store=store,
        )

        assert result == expected_payload
        kwargs = store.list_entries.await_args.kwargs
        assert kwargs["from_ts"] is not None
        assert kwargs["to_ts"] is not None
        assert kwargs["type_filter"] == "LOGIN_SUCCESS"
        assert kwargs["limit"] == 77

    @pytest.mark.asyncio
    async def test_get_access_audit_ignores_invalid_dates(self) -> None:
        user = CurrentUser(id=uuid.uuid4(), tenant_id=uuid.uuid4(), roles=["admin"])
        store = AsyncMock()
        store.list_entries = AsyncMock(return_value=[])

        await get_access_audit(
            _user=user,
            from_date="not-a-date",
            to_date="also-bad",
            type_filter=None,
            limit=5,
            store=store,
        )

        store.list_entries.assert_awaited_once_with(
            from_ts=None,
            to_ts=None,
            type_filter=None,
            limit=5,
        )

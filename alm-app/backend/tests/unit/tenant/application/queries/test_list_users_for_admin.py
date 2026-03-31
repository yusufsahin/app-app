from __future__ import annotations

import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from alm.tenant.application.queries.list_users_for_admin import (
    ListUsersForAdmin,
    ListUsersForAdminHandler,
)


class TestListUsersForAdminHandler:
    @pytest.mark.asyncio
    async def test_returns_summaries_and_role_slugs(self) -> None:
        tenant_id = uuid.uuid4()
        member_id = uuid.uuid4()
        user_id = uuid.uuid4()
        role_id = uuid.uuid4()

        membership_repo = AsyncMock()
        membership_repo.find_all_by_tenant.return_value = [SimpleNamespace(id=member_id, user_id=user_id)]
        membership_repo.get_role_ids.return_value = [role_id]

        deleted_at = datetime(2026, 3, 1, tzinfo=UTC)
        user_lookup = AsyncMock()
        user_lookup.find_by_id.return_value = SimpleNamespace(
            id=user_id,
            email="user@example.com",
            display_name="User",
            deleted_at=deleted_at,
        )

        role_repo = AsyncMock()
        role_repo.find_by_id.return_value = SimpleNamespace(slug="admin")

        handler = ListUsersForAdminHandler(
            membership_repo=membership_repo,
            role_repo=role_repo,
            user_lookup=user_lookup,
        )

        out = await handler.handle(ListUsersForAdmin(tenant_id=tenant_id, include_deleted=True))

        assert len(out) == 1
        assert out[0].user_id == user_id
        assert out[0].email == "user@example.com"
        assert out[0].display_name == "User"
        assert out[0].deleted_at == deleted_at
        assert out[0].role_slugs == ["admin"]

    @pytest.mark.asyncio
    async def test_skips_missing_user_info(self) -> None:
        tenant_id = uuid.uuid4()
        membership_repo = AsyncMock()
        membership_repo.find_all_by_tenant.return_value = [
            SimpleNamespace(id=uuid.uuid4(), user_id=uuid.uuid4())
        ]

        user_lookup = AsyncMock()
        user_lookup.find_by_id.return_value = None

        handler = ListUsersForAdminHandler(
            membership_repo=membership_repo,
            role_repo=AsyncMock(),
            user_lookup=user_lookup,
        )

        out = await handler.handle(ListUsersForAdmin(tenant_id=tenant_id, include_deleted=False))

        assert out == []

    @pytest.mark.asyncio
    async def test_excludes_deleted_when_include_deleted_false(self) -> None:
        tenant_id = uuid.uuid4()
        membership_repo = AsyncMock()
        membership_repo.find_all_by_tenant.return_value = [
            SimpleNamespace(id=uuid.uuid4(), user_id=uuid.uuid4())
        ]

        user_lookup = AsyncMock()
        user_lookup.find_by_id.return_value = SimpleNamespace(
            id=uuid.uuid4(),
            email="d@example.com",
            display_name="Deleted",
            deleted_at=datetime(2026, 1, 1, tzinfo=UTC),
        )

        handler = ListUsersForAdminHandler(
            membership_repo=membership_repo,
            role_repo=AsyncMock(),
            user_lookup=user_lookup,
        )

        out = await handler.handle(ListUsersForAdmin(tenant_id=tenant_id, include_deleted=False))

        assert out == []

    @pytest.mark.asyncio
    async def test_ignores_missing_roles(self) -> None:
        tenant_id = uuid.uuid4()
        user_id = uuid.uuid4()
        membership_repo = AsyncMock()
        membership_repo.find_all_by_tenant.return_value = [
            SimpleNamespace(id=uuid.uuid4(), user_id=user_id)
        ]
        membership_repo.get_role_ids.return_value = [uuid.uuid4(), uuid.uuid4()]

        user_lookup = AsyncMock()
        user_lookup.find_by_id.return_value = SimpleNamespace(
            id=user_id,
            email="u@example.com",
            display_name="U",
            deleted_at=None,
        )

        role_repo = AsyncMock()
        role_repo.find_by_id.return_value = None

        handler = ListUsersForAdminHandler(
            membership_repo=membership_repo,
            role_repo=role_repo,
            user_lookup=user_lookup,
        )

        out = await handler.handle(ListUsersForAdmin(tenant_id=tenant_id, include_deleted=False))

        assert len(out) == 1
        assert out[0].role_slugs == []

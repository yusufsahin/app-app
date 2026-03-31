from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from alm.shared.domain.exceptions import ConflictError, EntityNotFound, ValidationError
from alm.tenant.application.commands.create_user_by_admin import (
    CreateUserByAdmin,
    CreateUserByAdminHandler,
)


class TestCreateUserByAdminHandler:
    @pytest.mark.asyncio
    async def test_success_creates_membership_and_assigns_role(self) -> None:
        tenant_id = uuid.uuid4()
        role_id = uuid.uuid4()
        creator_id = uuid.uuid4()
        created_user_id = uuid.uuid4()

        user_creation = AsyncMock()
        user_creation.ensure_user.return_value = SimpleNamespace(
            user_id=created_user_id,
            email="new@example.com",
            display_name="New User",
        )
        membership_repo = AsyncMock()
        membership_repo.find_by_user_and_tenant.return_value = None
        membership_repo.add.return_value = SimpleNamespace(id=uuid.uuid4())
        role_repo = AsyncMock()
        role_repo.find_by_slug.return_value = SimpleNamespace(id=role_id)
        tenant_repo = AsyncMock()
        tenant_repo.find_by_id.return_value = SimpleNamespace(id=tenant_id)
        password_hasher = MagicMock()
        password_hasher.hash.return_value = "hashed"

        handler = CreateUserByAdminHandler(
            user_creation=user_creation,
            membership_repo=membership_repo,
            role_repo=role_repo,
            tenant_repo=tenant_repo,
            password_hasher=password_hasher,
        )

        result = await handler.handle(
            CreateUserByAdmin(
                tenant_id=tenant_id,
                email="new@example.com",
                password="Passw0rd!",
                display_name="New User",
                role_slug="member",
                created_by=creator_id,
            )
        )

        assert result.user_id == created_user_id
        assert result.email == "new@example.com"
        assert result.display_name == "New User"
        password_hasher.hash.assert_called_once_with("Passw0rd!")
        membership_repo.add_role.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_raises_when_tenant_missing(self) -> None:
        tenant_repo = AsyncMock()
        tenant_repo.find_by_id.return_value = None
        handler = CreateUserByAdminHandler(
            user_creation=AsyncMock(),
            membership_repo=AsyncMock(),
            role_repo=AsyncMock(),
            tenant_repo=tenant_repo,
            password_hasher=MagicMock(),
        )

        with pytest.raises(EntityNotFound, match="Tenant"):
            await handler.handle(
                CreateUserByAdmin(
                    tenant_id=uuid.uuid4(),
                    email="a@example.com",
                    password="Passw0rd!",
                    display_name="A",
                    role_slug="member",
                    created_by=uuid.uuid4(),
                )
            )

    @pytest.mark.asyncio
    async def test_raises_when_role_missing(self) -> None:
        tenant_repo = AsyncMock()
        tenant_repo.find_by_id.return_value = SimpleNamespace(id=uuid.uuid4())
        role_repo = AsyncMock()
        role_repo.find_by_slug.return_value = None
        handler = CreateUserByAdminHandler(
            user_creation=AsyncMock(),
            membership_repo=AsyncMock(),
            role_repo=role_repo,
            tenant_repo=tenant_repo,
            password_hasher=MagicMock(),
        )

        with pytest.raises(EntityNotFound, match="Role"):
            await handler.handle(
                CreateUserByAdmin(
                    tenant_id=uuid.uuid4(),
                    email="a@example.com",
                    password="Passw0rd!",
                    display_name="A",
                    role_slug="member",
                    created_by=uuid.uuid4(),
                )
            )

    @pytest.mark.asyncio
    async def test_raises_for_short_password(self) -> None:
        tenant_repo = AsyncMock()
        tenant_repo.find_by_id.return_value = SimpleNamespace(id=uuid.uuid4())
        role_repo = AsyncMock()
        role_repo.find_by_slug.return_value = SimpleNamespace(id=uuid.uuid4())
        handler = CreateUserByAdminHandler(
            user_creation=AsyncMock(),
            membership_repo=AsyncMock(),
            role_repo=role_repo,
            tenant_repo=tenant_repo,
            password_hasher=MagicMock(),
        )

        with pytest.raises(ValidationError, match="at least 8"):
            await handler.handle(
                CreateUserByAdmin(
                    tenant_id=uuid.uuid4(),
                    email="a@example.com",
                    password="short",
                    display_name="A",
                    role_slug="member",
                    created_by=uuid.uuid4(),
                )
            )

    @pytest.mark.asyncio
    async def test_raises_when_user_already_member(self) -> None:
        tenant_id = uuid.uuid4()
        user_id = uuid.uuid4()

        user_creation = AsyncMock()
        user_creation.ensure_user.return_value = SimpleNamespace(
            user_id=user_id,
            email="existing@example.com",
            display_name="Existing",
        )
        membership_repo = AsyncMock()
        membership_repo.find_by_user_and_tenant.return_value = SimpleNamespace(id=uuid.uuid4())
        role_repo = AsyncMock()
        role_repo.find_by_slug.return_value = SimpleNamespace(id=uuid.uuid4())
        tenant_repo = AsyncMock()
        tenant_repo.find_by_id.return_value = SimpleNamespace(id=tenant_id)

        handler = CreateUserByAdminHandler(
            user_creation=user_creation,
            membership_repo=membership_repo,
            role_repo=role_repo,
            tenant_repo=tenant_repo,
            password_hasher=MagicMock(hash=MagicMock(return_value="hashed")),
        )

        with pytest.raises(ConflictError, match="already a member"):
            await handler.handle(
                CreateUserByAdmin(
                    tenant_id=tenant_id,
                    email="existing@example.com",
                    password="Passw0rd!",
                    display_name="Existing",
                    role_slug="member",
                    created_by=uuid.uuid4(),
                )
            )

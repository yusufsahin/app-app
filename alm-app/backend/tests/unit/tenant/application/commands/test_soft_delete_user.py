import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from alm.shared.domain.exceptions import AccessDenied, ValidationError
from alm.tenant.application.commands.soft_delete_user import SoftDeleteUser, SoftDeleteUserHandler


@pytest.mark.asyncio
async def test_soft_delete_user_self_deletion():
    # Arrange
    user_id = uuid.uuid4()
    handler = SoftDeleteUserHandler(AsyncMock(), AsyncMock(), AsyncMock())
    command = SoftDeleteUser(tenant_id=uuid.uuid4(), user_id=user_id, deleted_by=user_id)

    # Act & Assert
    with pytest.raises(ValidationError, match="Cannot delete your own account"):
        await handler.handle(command)


@pytest.mark.asyncio
async def test_soft_delete_user_last_admin():
    # Arrange
    tenant_id = uuid.uuid4()
    user_id = uuid.uuid4()
    admin_id = uuid.uuid4()

    membership = MagicMock(id=uuid.uuid4(), user_id=user_id)
    user = MagicMock(deleted_at=None)
    admin_role = MagicMock(slug="admin")

    user_repo = AsyncMock()
    user_repo.find_by_id.return_value = user

    membership_repo = AsyncMock()
    membership_repo.find_by_user_and_tenant.return_value = membership
    membership_repo.get_role_ids.return_value = [uuid.uuid4()]
    membership_repo.find_all_by_tenant.return_value = [membership] # only one member

    role_repo = AsyncMock()
    role_repo.find_by_id.return_value = admin_role

    handler = SoftDeleteUserHandler(user_repo, membership_repo, role_repo)
    command = SoftDeleteUser(tenant_id=tenant_id, user_id=user_id, deleted_by=admin_id)

    # Act & Assert
    with pytest.raises(AccessDenied, match="Cannot delete the last admin"):
        await handler.handle(command)


@pytest.mark.asyncio
async def test_soft_delete_user_success():
    # Arrange
    tenant_id = uuid.uuid4()
    user_id = uuid.uuid4()
    admin_id = uuid.uuid4()

    membership = MagicMock(id=uuid.uuid4(), user_id=user_id)

    user = MagicMock(deleted_at=None)
    admin_user = MagicMock(deleted_at=None)

    member_role = MagicMock(slug="member")

    user_repo = AsyncMock()
    user_repo.find_by_id.side_effect = lambda id, **k: {user_id: user, admin_id: admin_user}.get(id)

    membership_repo = AsyncMock()
    membership_repo.find_by_user_and_tenant.return_value = membership
    membership_repo.get_role_ids.return_value = [uuid.uuid4()]

    role_repo = AsyncMock()
    role_repo.find_by_id.return_value = member_role

    handler = SoftDeleteUserHandler(user_repo, membership_repo, role_repo)
    command = SoftDeleteUser(tenant_id=tenant_id, user_id=user_id, deleted_by=admin_id)

    # Act
    await handler.handle(command)

    # Assert
    user_repo.soft_delete.assert_called_with(user_id, admin_id)

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from alm.shared.domain.exceptions import ConflictError, EntityNotFound
from alm.tenant.application.commands.invite_member import InviteMember, InviteMemberHandler


@pytest.mark.asyncio
async def test_invite_member_success():
    # Arrange
    tenant_id = uuid.uuid4()
    invited_by = uuid.uuid4()
    role_id = uuid.uuid4()
    email = "new@example.com"

    invitation_repo = AsyncMock()
    invitation_repo.find_pending_by_email_and_tenant.return_value = None
    invitation_repo.add.side_effect = lambda i: i

    role = MagicMock(id=role_id, tenant_id=tenant_id, name="Member", slug="member")
    role_repo = AsyncMock()
    role_repo.find_by_id.return_value = role

    tenant_repo = AsyncMock()
    tenant_repo.find_by_id.return_value = MagicMock(name="Test Tenant")

    user_lookup = AsyncMock()
    user_lookup.find_by_id.return_value = MagicMock(display_name="Inviter")

    email_sender = AsyncMock()

    handler = InviteMemberHandler(
        invitation_repo, role_repo, tenant_repo, user_lookup, email_sender
    )

    command = InviteMember(
        tenant_id=tenant_id,
        email=email,
        role_ids=[role_id],
        invited_by=invited_by
    )

    # Act
    # Mocking invitation_email_html to avoid real template generation
    with patch("alm.tenant.application.commands.invite_member.invitation_email_html", return_value=("sub", "html")):
        result = await handler.handle(command)

    # Assert
    assert result.email == email
    assert len(result.roles) == 1
    assert result.roles[0].slug == "member"
    invitation_repo.add.assert_called()
    email_sender.send.assert_called()


@pytest.mark.asyncio
async def test_invite_member_already_pending():
    # Arrange
    tenant_id = uuid.uuid4()
    email = "pending@example.com"

    existing_inv = MagicMock(is_valid=True)
    invitation_repo = AsyncMock()
    invitation_repo.find_pending_by_email_and_tenant.return_value = existing_inv

    handler = InviteMemberHandler(invitation_repo, AsyncMock(), AsyncMock(), AsyncMock(), AsyncMock())
    command = InviteMember(tenant_id=tenant_id, email=email, role_ids=[], invited_by=uuid.uuid4())

    # Act & Assert
    with pytest.raises(ConflictError, match="pending invitation already exists"):
        await handler.handle(command)


@pytest.mark.asyncio
async def test_invite_member_role_not_found():
    # Arrange
    tenant_id = uuid.uuid4()
    role_id = uuid.uuid4()

    invitation_repo = AsyncMock()
    invitation_repo.find_pending_by_email_and_tenant.return_value = None

    role_repo = AsyncMock()
    role_repo.find_by_id.return_value = None # Role doesn't exist

    handler = InviteMemberHandler(invitation_repo, role_repo, AsyncMock(), AsyncMock(), AsyncMock())
    command = InviteMember(tenant_id=tenant_id, email="test@example.com", role_ids=[role_id], invited_by=uuid.uuid4())

    # Act & Assert
    with pytest.raises(EntityNotFound, match="Role"):
        await handler.handle(command)

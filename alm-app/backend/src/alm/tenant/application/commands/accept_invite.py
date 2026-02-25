from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ValidationError
from alm.tenant.application.dtos import MembershipDTO
from alm.tenant.domain.entities import TenantMembership
from alm.tenant.domain.ports import InvitationRepository, MembershipRepository


@dataclass(frozen=True)
class AcceptInvite(Command):
    token: str
    user_id: uuid.UUID


class AcceptInviteHandler(CommandHandler[MembershipDTO]):
    def __init__(
        self,
        invitation_repo: InvitationRepository,
        membership_repo: MembershipRepository,
    ) -> None:
        self._invitation_repo = invitation_repo
        self._membership_repo = membership_repo

    async def handle(self, command: Command) -> MembershipDTO:
        assert isinstance(command, AcceptInvite)
        invitation = await self._invitation_repo.find_by_token(command.token)
        if invitation is None:
            raise ValidationError("Invalid invitation token")

        invitation.accept()

        membership = TenantMembership(
            user_id=command.user_id,
            tenant_id=invitation.tenant_id,
            invited_by=invitation.invited_by,
        )
        membership = await self._membership_repo.add(membership)

        for role_id in invitation.role_ids:
            await self._membership_repo.add_role(membership.id, role_id, assigned_by=invitation.invited_by)

        await self._invitation_repo.update(invitation)

        return MembershipDTO(
            id=membership.id,
            user_id=membership.user_id,
            tenant_id=membership.tenant_id,
        )

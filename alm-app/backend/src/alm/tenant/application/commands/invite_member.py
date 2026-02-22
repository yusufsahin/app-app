from __future__ import annotations

import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ConflictError, EntityNotFound
from alm.tenant.application.dtos import InvitationDTO, RoleInfoDTO
from alm.tenant.domain.entities import Invitation
from alm.tenant.domain.events import MemberInvited
from alm.tenant.domain.ports import InvitationRepository, RoleRepository


@dataclass(frozen=True)
class InviteMember(Command):
    tenant_id: uuid.UUID
    email: str
    role_ids: list[uuid.UUID]
    invited_by: uuid.UUID


class InviteMemberHandler(CommandHandler[InvitationDTO]):
    def __init__(
        self,
        invitation_repo: InvitationRepository,
        role_repo: RoleRepository,
    ) -> None:
        self._invitation_repo = invitation_repo
        self._role_repo = role_repo

    async def handle(self, command: Command) -> InvitationDTO:
        assert isinstance(command, InviteMember)
        existing = await self._invitation_repo.find_pending_by_email_and_tenant(
            command.email, command.tenant_id
        )
        if existing is not None and existing.is_valid:
            raise ConflictError(f"A pending invitation already exists for {command.email}")

        roles: list[RoleInfoDTO] = []
        for role_id in command.role_ids:
            role = await self._role_repo.find_by_id(role_id)
            if role is None or role.tenant_id != command.tenant_id:
                raise EntityNotFound("Role", role_id)
            roles.append(RoleInfoDTO(
                id=role.id,
                name=role.name,
                slug=role.slug,
                is_system=role.is_system,
                hierarchy_level=role.hierarchy_level,
            ))

        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(UTC) + timedelta(days=7)

        invitation = Invitation(
            tenant_id=command.tenant_id,
            email=command.email,
            invited_by=command.invited_by,
            token=token,
            expires_at=expires_at,
            role_ids=list(command.role_ids),
        )
        invitation._register_event(MemberInvited(
            tenant_id=command.tenant_id,
            email=command.email,
            invited_by=command.invited_by,
            role_ids=list(command.role_ids),
        ))
        inv = await self._invitation_repo.add(invitation)

        return InvitationDTO(
            id=inv.id,
            email=inv.email,
            roles=roles,
            expires_at=inv.expires_at,
            accepted_at=inv.accepted_at,
        )

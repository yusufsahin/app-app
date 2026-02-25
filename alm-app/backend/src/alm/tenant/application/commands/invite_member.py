from __future__ import annotations

import asyncio
import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ConflictError, EntityNotFound
from alm.shared.domain.ports import IEmailSender
from alm.shared.infrastructure.email_templates import invitation_email_html
from alm.tenant.application.dtos import InvitationDTO, RoleInfoDTO
from alm.tenant.domain.entities import Invitation
from alm.tenant.domain.events import MemberInvited
from alm.tenant.domain.ports import (
    InvitationRepository,
    RoleRepository,
    TenantRepository,
    UserLookupPort,
)


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
        tenant_repo: TenantRepository,
        user_lookup: UserLookupPort,
        email_sender: IEmailSender,
    ) -> None:
        self._invitation_repo = invitation_repo
        self._role_repo = role_repo
        self._tenant_repo = tenant_repo
        self._user_lookup = user_lookup
        self._email_sender = email_sender

    async def handle(self, command: Command) -> InvitationDTO:
        assert isinstance(command, InviteMember)
        existing = await self._invitation_repo.find_pending_by_email_and_tenant(command.email, command.tenant_id)
        if existing is not None and existing.is_valid:
            raise ConflictError(f"A pending invitation already exists for {command.email}")

        roles: list[RoleInfoDTO] = []
        for role_id in command.role_ids:
            role = await self._role_repo.find_by_id(role_id)
            if role is None or role.tenant_id != command.tenant_id:
                raise EntityNotFound("Role", role_id)
            roles.append(
                RoleInfoDTO(
                    id=role.id,
                    name=role.name,
                    slug=role.slug,
                    is_system=role.is_system,
                    hierarchy_level=role.hierarchy_level,
                )
            )

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
        invitation._register_event(
            MemberInvited(
                tenant_id=command.tenant_id,
                email=command.email,
                invited_by=command.invited_by,
                role_ids=list(command.role_ids),
            )
        )
        inv = await self._invitation_repo.add(invitation)

        # Fire-and-forget email
        tenant = await self._tenant_repo.find_by_id(command.tenant_id)
        inviter = await self._user_lookup.find_by_id(command.invited_by)
        tenant_name = tenant.name if tenant else "Unknown"
        inviter_name = inviter.display_name if inviter else "Someone"
        role_names = [r.name for r in roles]
        subject, html = invitation_email_html(
            email=command.email,
            tenant_name=tenant_name,
            inviter_name=inviter_name,
            invite_token=token,
            roles=role_names,
        )
        asyncio.create_task(self._email_sender.send(command.email, subject, html))  # type: ignore[arg-type]

        return InvitationDTO(
            id=inv.id,
            email=inv.email,
            roles=roles,
            expires_at=inv.expires_at,
            accepted_at=inv.accepted_at,
        )

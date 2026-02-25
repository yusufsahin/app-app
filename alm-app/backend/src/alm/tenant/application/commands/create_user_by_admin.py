"""G1: Admin creates a user in the tenant (email + password + role), without invite flow."""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.auth.domain.entities import User
from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ConflictError, EntityNotFound, ValidationError
from alm.shared.infrastructure.security.password import hash_password
from alm.tenant.domain.entities import TenantMembership
from alm.tenant.domain.ports import (
    MembershipRepository,
    RoleRepository,
    TenantRepository,
)

from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from alm.auth.domain.ports import UserRepository


@dataclass(frozen=True)
class CreateUserByAdmin(Command):
    tenant_id: uuid.UUID
    email: str
    password: str
    display_name: str
    role_slug: str
    created_by: uuid.UUID


@dataclass(frozen=True)
class CreateUserByAdminResult:
    user_id: uuid.UUID
    email: str
    display_name: str


class CreateUserByAdminHandler(CommandHandler[CreateUserByAdminResult]):
    def __init__(
        self,
        user_repo: "UserRepository",
        membership_repo: MembershipRepository,
        role_repo: RoleRepository,
        tenant_repo: TenantRepository,
    ) -> None:
        self._user_repo = user_repo
        self._membership_repo = membership_repo
        self._role_repo = role_repo
        self._tenant_repo = tenant_repo

    async def handle(self, command: Command) -> CreateUserByAdminResult:
        assert isinstance(command, CreateUserByAdmin)
        tenant = await self._tenant_repo.find_by_id(command.tenant_id)
        if tenant is None:
            raise EntityNotFound("Tenant", str(command.tenant_id))
        role = await self._role_repo.find_by_slug(command.tenant_id, command.role_slug)
        if role is None:
            raise EntityNotFound("Role", command.role_slug)
        if not command.email or not command.password.strip():
            raise ValidationError("Email and password are required.")
        if len(command.password) < 8:
            raise ValidationError("Password must be at least 8 characters.")

        user = await self._user_repo.find_by_email(command.email)
        if user is not None:
            existing_membership = await self._membership_repo.find_by_user_and_tenant(
                user.id, command.tenant_id
            )
            if existing_membership is not None:
                raise ConflictError(f"User {command.email} is already a member of this tenant.")
        else:
            password_hash = hash_password(command.password)
            user = User.create(
                email=command.email,
                display_name=command.display_name or command.email,
                password_hash=password_hash,
            )
            await self._user_repo.add(user)

        membership = TenantMembership(
            user_id=user.id,
            tenant_id=command.tenant_id,
            invited_by=command.created_by,
        )
        membership = await self._membership_repo.add(membership)
        await self._membership_repo.add_role(
            membership.id, role.id, assigned_by=command.created_by
        )
        return CreateUserByAdminResult(
            user_id=user.id,
            email=user.email,
            display_name=user.display_name,
        )

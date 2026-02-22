from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from alm.shared.application.mediator import buffer_events
from alm.tenant.domain.entities import Invitation, Privilege, Role, Tenant, TenantMembership
from alm.tenant.domain.ports import (
    InvitationRepository,
    MembershipRepository,
    PrivilegeRepository,
    RoleRepository,
    TenantRepository,
)
from alm.tenant.infrastructure.models import (
    InvitationModel,
    InvitationRoleModel,
    MembershipRoleModel,
    PrivilegeModel,
    RoleModel,
    RolePrivilegeModel,
    TenantMembershipModel,
    TenantModel,
)


# ── Tenant ──


class SqlAlchemyTenantRepository(TenantRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def find_by_id(self, tenant_id: uuid.UUID) -> Tenant | None:
        result = await self._session.execute(
            select(TenantModel).where(TenantModel.id == tenant_id, TenantModel.deleted_at.is_(None))
        )
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def find_by_slug(self, slug: str) -> Tenant | None:
        result = await self._session.execute(
            select(TenantModel).where(TenantModel.slug == slug, TenantModel.deleted_at.is_(None))
        )
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def add(self, tenant: Tenant) -> Tenant:
        model = TenantModel(
            id=tenant.id, name=tenant.name, slug=tenant.slug, tier=tenant.tier, settings=tenant.settings
        )
        self._session.add(model)
        await self._session.flush()
        buffer_events(self._session, tenant.collect_events())
        return tenant

    async def update(self, tenant: Tenant) -> Tenant:
        await self._session.execute(
            update(TenantModel)
            .where(TenantModel.id == tenant.id)
            .values(name=tenant.name, slug=tenant.slug, tier=tenant.tier, settings=tenant.settings)
        )
        await self._session.flush()
        buffer_events(self._session, tenant.collect_events())
        return tenant

    @staticmethod
    def _to_entity(m: TenantModel) -> Tenant:
        t = Tenant(name=m.name, slug=m.slug, id=m.id, tier=m.tier, settings=m.settings)
        t.created_at = m.created_at
        t.updated_at = m.updated_at
        t.deleted_at = m.deleted_at
        return t


# ── Membership ──


class SqlAlchemyMembershipRepository(MembershipRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def find_by_id(self, membership_id: uuid.UUID) -> TenantMembership | None:
        result = await self._session.execute(
            select(TenantMembershipModel).where(
                TenantMembershipModel.id == membership_id,
                TenantMembershipModel.deleted_at.is_(None),
            )
        )
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def find_by_user_and_tenant(
        self, user_id: uuid.UUID, tenant_id: uuid.UUID
    ) -> TenantMembership | None:
        result = await self._session.execute(
            select(TenantMembershipModel).where(
                TenantMembershipModel.user_id == user_id,
                TenantMembershipModel.tenant_id == tenant_id,
                TenantMembershipModel.deleted_at.is_(None),
            )
        )
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def find_all_by_user(self, user_id: uuid.UUID) -> list[TenantMembership]:
        result = await self._session.execute(
            select(TenantMembershipModel).where(
                TenantMembershipModel.user_id == user_id,
                TenantMembershipModel.deleted_at.is_(None),
            )
        )
        return [self._to_entity(m) for m in result.scalars().all()]

    async def find_all_by_tenant(self, tenant_id: uuid.UUID) -> list[TenantMembership]:
        result = await self._session.execute(
            select(TenantMembershipModel).where(
                TenantMembershipModel.tenant_id == tenant_id,
                TenantMembershipModel.deleted_at.is_(None),
            )
        )
        return [self._to_entity(m) for m in result.scalars().all()]

    async def add(self, membership: TenantMembership) -> TenantMembership:
        model = TenantMembershipModel(
            id=membership.id,
            user_id=membership.user_id,
            tenant_id=membership.tenant_id,
            invited_by=membership.invited_by,
        )
        self._session.add(model)
        await self._session.flush()
        return membership

    async def soft_delete(self, membership_id: uuid.UUID, deleted_by: uuid.UUID) -> None:
        await self._session.execute(
            update(TenantMembershipModel)
            .where(TenantMembershipModel.id == membership_id)
            .values(deleted_at=datetime.now(UTC), deleted_by=deleted_by)
        )
        await self._session.flush()

    # ── Role assignment ──

    async def get_role_ids(self, membership_id: uuid.UUID) -> list[uuid.UUID]:
        result = await self._session.execute(
            select(MembershipRoleModel.role_id).where(MembershipRoleModel.membership_id == membership_id)
        )
        return list(result.scalars().all())

    async def set_roles(
        self, membership_id: uuid.UUID, role_ids: list[uuid.UUID], assigned_by: uuid.UUID
    ) -> None:
        await self._session.execute(
            delete(MembershipRoleModel).where(MembershipRoleModel.membership_id == membership_id)
        )
        for role_id in role_ids:
            self._session.add(
                MembershipRoleModel(membership_id=membership_id, role_id=role_id, assigned_by=assigned_by)
            )
        await self._session.flush()

    async def add_role(self, membership_id: uuid.UUID, role_id: uuid.UUID, assigned_by: uuid.UUID) -> None:
        self._session.add(
            MembershipRoleModel(membership_id=membership_id, role_id=role_id, assigned_by=assigned_by)
        )
        await self._session.flush()

    async def remove_role(self, membership_id: uuid.UUID, role_id: uuid.UUID) -> None:
        await self._session.execute(
            delete(MembershipRoleModel).where(
                MembershipRoleModel.membership_id == membership_id,
                MembershipRoleModel.role_id == role_id,
            )
        )
        await self._session.flush()

    @staticmethod
    def _to_entity(m: TenantMembershipModel) -> TenantMembership:
        ms = TenantMembership(user_id=m.user_id, tenant_id=m.tenant_id, id=m.id, invited_by=m.invited_by)
        ms.joined_at = m.joined_at
        ms.created_at = m.created_at
        ms.updated_at = m.updated_at
        ms.deleted_at = m.deleted_at
        return ms


# ── Role ──


class SqlAlchemyRoleRepository(RoleRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def find_by_id(self, role_id: uuid.UUID) -> Role | None:
        result = await self._session.execute(
            select(RoleModel).where(RoleModel.id == role_id, RoleModel.deleted_at.is_(None))
        )
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def find_by_slug(self, tenant_id: uuid.UUID, slug: str) -> Role | None:
        result = await self._session.execute(
            select(RoleModel).where(
                RoleModel.tenant_id == tenant_id,
                RoleModel.slug == slug,
                RoleModel.deleted_at.is_(None),
            )
        )
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def find_all_by_tenant(self, tenant_id: uuid.UUID) -> list[Role]:
        result = await self._session.execute(
            select(RoleModel)
            .where(RoleModel.tenant_id == tenant_id, RoleModel.deleted_at.is_(None))
            .order_by(RoleModel.hierarchy_level)
        )
        return [self._to_entity(m) for m in result.scalars().all()]

    async def add(self, role: Role) -> Role:
        model = RoleModel(
            id=role.id,
            tenant_id=role.tenant_id,
            name=role.name,
            slug=role.slug,
            description=role.description,
            is_system=role.is_system,
            hierarchy_level=role.hierarchy_level,
        )
        self._session.add(model)
        await self._session.flush()
        buffer_events(self._session, role.collect_events())
        return role

    async def update(self, role: Role) -> Role:
        await self._session.execute(
            update(RoleModel)
            .where(RoleModel.id == role.id)
            .values(
                name=role.name,
                slug=role.slug,
                description=role.description,
                hierarchy_level=role.hierarchy_level,
            )
        )
        await self._session.flush()
        buffer_events(self._session, role.collect_events())
        return role

    async def soft_delete(self, role_id: uuid.UUID, deleted_by: uuid.UUID) -> None:
        await self._session.execute(
            update(RoleModel)
            .where(RoleModel.id == role_id)
            .values(deleted_at=datetime.now(UTC), deleted_by=deleted_by)
        )
        await self._session.flush()

    async def set_privileges(self, role_id: uuid.UUID, privilege_ids: list[uuid.UUID]) -> None:
        await self._session.execute(
            delete(RolePrivilegeModel).where(RolePrivilegeModel.role_id == role_id)
        )
        for pid in privilege_ids:
            self._session.add(RolePrivilegeModel(role_id=role_id, privilege_id=pid))
        await self._session.flush()

    async def get_privilege_ids(self, role_id: uuid.UUID) -> list[uuid.UUID]:
        result = await self._session.execute(
            select(RolePrivilegeModel.privilege_id).where(RolePrivilegeModel.role_id == role_id)
        )
        return list(result.scalars().all())

    async def get_role_slugs_for_membership(self, membership_id: uuid.UUID) -> list[str]:
        result = await self._session.execute(
            select(RoleModel.slug)
            .join(MembershipRoleModel, MembershipRoleModel.role_id == RoleModel.id)
            .where(
                MembershipRoleModel.membership_id == membership_id,
                RoleModel.deleted_at.is_(None),
            )
        )
        return list(result.scalars().all())

    async def get_privilege_codes_for_roles(self, role_ids: list[uuid.UUID]) -> list[str]:
        if not role_ids:
            return []
        result = await self._session.execute(
            select(PrivilegeModel.code)
            .join(RolePrivilegeModel, RolePrivilegeModel.privilege_id == PrivilegeModel.id)
            .where(RolePrivilegeModel.role_id.in_(role_ids))
            .distinct()
        )
        return list(result.scalars().all())

    @staticmethod
    def _to_entity(m: RoleModel) -> Role:
        role = Role(
            tenant_id=m.tenant_id,
            name=m.name,
            slug=m.slug,
            id=m.id,
            description=m.description,
            is_system=m.is_system,
            hierarchy_level=m.hierarchy_level,
        )
        role.privilege_ids = [rp.privilege_id for rp in m.role_privileges]
        role.created_at = m.created_at
        role.updated_at = m.updated_at
        role.deleted_at = m.deleted_at
        return role


# ── Privilege ──


class SqlAlchemyPrivilegeRepository(PrivilegeRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def find_by_id(self, privilege_id: uuid.UUID) -> Privilege | None:
        result = await self._session.execute(
            select(PrivilegeModel).where(PrivilegeModel.id == privilege_id)
        )
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def find_by_code(self, code: str) -> Privilege | None:
        result = await self._session.execute(
            select(PrivilegeModel).where(PrivilegeModel.code == code)
        )
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def find_all(self) -> list[Privilege]:
        result = await self._session.execute(select(PrivilegeModel).order_by(PrivilegeModel.resource, PrivilegeModel.action))
        return [self._to_entity(m) for m in result.scalars().all()]

    async def find_by_codes(self, codes: list[str]) -> list[Privilege]:
        if not codes:
            return []
        result = await self._session.execute(
            select(PrivilegeModel).where(PrivilegeModel.code.in_(codes))
        )
        return [self._to_entity(m) for m in result.scalars().all()]

    async def add(self, privilege: Privilege) -> Privilege:
        model = PrivilegeModel(
            id=privilege.id,
            code=privilege.code,
            resource=privilege.resource,
            action=privilege.action,
            description=privilege.description,
        )
        self._session.add(model)
        await self._session.flush()
        return privilege

    async def add_many(self, privileges: list[Privilege]) -> None:
        for p in privileges:
            self._session.add(
                PrivilegeModel(id=p.id, code=p.code, resource=p.resource, action=p.action, description=p.description)
            )
        await self._session.flush()

    @staticmethod
    def _to_entity(m: PrivilegeModel) -> Privilege:
        return Privilege(code=m.code, resource=m.resource, action=m.action, id=m.id, description=m.description)


# ── Invitation ──


class SqlAlchemyInvitationRepository(InvitationRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def find_by_id(self, invitation_id: uuid.UUID) -> Invitation | None:
        result = await self._session.execute(
            select(InvitationModel).where(InvitationModel.id == invitation_id)
        )
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def find_by_token(self, token: str) -> Invitation | None:
        result = await self._session.execute(
            select(InvitationModel).where(InvitationModel.token == token)
        )
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def find_pending_by_email_and_tenant(
        self, email: str, tenant_id: uuid.UUID
    ) -> Invitation | None:
        result = await self._session.execute(
            select(InvitationModel).where(
                InvitationModel.email == email,
                InvitationModel.tenant_id == tenant_id,
                InvitationModel.accepted_at.is_(None),
            )
        )
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def add(self, invitation: Invitation) -> Invitation:
        model = InvitationModel(
            id=invitation.id,
            tenant_id=invitation.tenant_id,
            email=invitation.email,
            invited_by=invitation.invited_by,
            token=invitation.token,
            expires_at=invitation.expires_at,
        )
        for role_id in invitation.role_ids:
            model.invitation_roles.append(InvitationRoleModel(invitation_id=invitation.id, role_id=role_id))
        self._session.add(model)
        await self._session.flush()
        buffer_events(self._session, invitation.collect_events())
        return invitation

    async def update(self, invitation: Invitation) -> Invitation:
        await self._session.execute(
            update(InvitationModel)
            .where(InvitationModel.id == invitation.id)
            .values(accepted_at=invitation.accepted_at)
        )
        await self._session.flush()
        buffer_events(self._session, invitation.collect_events())
        return invitation

    @staticmethod
    def _to_entity(m: InvitationModel) -> Invitation:
        inv = Invitation(
            tenant_id=m.tenant_id,
            email=m.email,
            invited_by=m.invited_by,
            token=m.token,
            expires_at=m.expires_at,
            id=m.id,
            role_ids=[ir.role_id for ir in m.invitation_roles],
        )
        inv.accepted_at = m.accepted_at
        inv.created_at = m.created_at
        return inv

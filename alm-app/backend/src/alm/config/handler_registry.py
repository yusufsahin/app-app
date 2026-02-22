"""Registers all command/query handler factories with the Mediator.

Called once at application startup from main.py.
Each factory receives an AsyncSession and returns a fully-wired handler.
"""

from __future__ import annotations

from alm.shared.application.mediator import register_command_handler, register_query_handler

# ── Auth commands ──
from alm.auth.application.commands.register import RegisterUser, RegisterUserHandler
from alm.auth.application.commands.login import Login, LoginHandler
from alm.auth.application.commands.switch_tenant import SwitchTenant, SwitchTenantHandler
from alm.auth.application.commands.refresh_token import RefreshTokenCommand, RefreshTokenHandler
from alm.auth.application.commands.change_password import ChangePassword, ChangePasswordHandler
from alm.auth.application.commands.update_profile import UpdateProfile, UpdateProfileHandler

# ── Auth queries ──
from alm.auth.application.queries.get_current_user import GetCurrentUser, GetCurrentUserHandler

# ── Tenant commands ──
from alm.tenant.application.commands.create_tenant import CreateTenant, CreateTenantHandler
from alm.tenant.application.commands.invite_member import InviteMember, InviteMemberHandler
from alm.tenant.application.commands.accept_invite import AcceptInvite, AcceptInviteHandler
from alm.tenant.application.commands.assign_roles import AssignRoles, AssignRolesHandler
from alm.tenant.application.commands.revoke_role import RevokeRole, RevokeRoleHandler
from alm.tenant.application.commands.remove_member import RemoveMember, RemoveMemberHandler
from alm.tenant.application.commands.create_role import CreateRole, CreateRoleHandler
from alm.tenant.application.commands.update_role import UpdateRole, UpdateRoleHandler
from alm.tenant.application.commands.delete_role import DeleteRole, DeleteRoleHandler
from alm.tenant.application.commands.set_role_privileges import SetRolePrivileges, SetRolePrivilegesHandler
from alm.tenant.application.commands.update_tenant import UpdateTenant, UpdateTenantHandler
from alm.tenant.application.commands.add_role_to_member import AddRoleToMember, AddRoleToMemberHandler

# ── Tenant queries ──
from alm.tenant.application.queries.list_tenants import ListMyTenants, ListMyTenantsHandler
from alm.tenant.application.queries.list_members import ListTenantMembers, ListTenantMembersHandler
from alm.tenant.application.queries.list_roles import ListTenantRoles, ListTenantRolesHandler
from alm.tenant.application.queries.get_role import GetRole, GetRoleHandler
from alm.tenant.application.queries.list_privileges import ListPrivileges, ListPrivilegesHandler
from alm.tenant.application.queries.get_tenant import GetTenant, GetTenantHandler
from alm.tenant.application.queries.get_member_roles import GetMemberRoles, GetMemberRolesHandler
from alm.tenant.application.queries.get_member_permissions import (
    GetMemberEffectivePermissions,
    GetMemberEffectivePermissionsHandler,
)

# ── Repository imports ──
from alm.auth.infrastructure.repositories import SqlAlchemyUserRepository, SqlAlchemyRefreshTokenRepository
from alm.tenant.infrastructure.repositories import (
    SqlAlchemyTenantRepository,
    SqlAlchemyMembershipRepository,
    SqlAlchemyRoleRepository,
    SqlAlchemyPrivilegeRepository,
    SqlAlchemyInvitationRepository,
)
from alm.tenant.domain.services import TenantOnboardingSaga


def register_all_handlers() -> None:
    # ── Auth Commands ──

    register_command_handler(RegisterUser, lambda s: RegisterUserHandler(
        user_repo=SqlAlchemyUserRepository(s),
        refresh_token_repo=SqlAlchemyRefreshTokenRepository(s),
        onboarding=TenantOnboardingSaga(
            tenant_repo=SqlAlchemyTenantRepository(s),
            role_repo=SqlAlchemyRoleRepository(s),
            privilege_repo=SqlAlchemyPrivilegeRepository(s),
            membership_repo=SqlAlchemyMembershipRepository(s),
        ),
    ))

    register_command_handler(Login, lambda s: LoginHandler(
        user_repo=SqlAlchemyUserRepository(s),
        refresh_token_repo=SqlAlchemyRefreshTokenRepository(s),
        membership_repo=SqlAlchemyMembershipRepository(s),
        role_repo=SqlAlchemyRoleRepository(s),
        tenant_repo=SqlAlchemyTenantRepository(s),
    ))

    register_command_handler(SwitchTenant, lambda s: SwitchTenantHandler(
        membership_repo=SqlAlchemyMembershipRepository(s),
        role_repo=SqlAlchemyRoleRepository(s),
        refresh_token_repo=SqlAlchemyRefreshTokenRepository(s),
    ))

    register_command_handler(RefreshTokenCommand, lambda s: RefreshTokenHandler(
        refresh_token_repo=SqlAlchemyRefreshTokenRepository(s),
        user_repo=SqlAlchemyUserRepository(s),
        membership_repo=SqlAlchemyMembershipRepository(s),
        role_repo=SqlAlchemyRoleRepository(s),
    ))

    register_command_handler(ChangePassword, lambda s: ChangePasswordHandler(
        user_repo=SqlAlchemyUserRepository(s),
        refresh_token_repo=SqlAlchemyRefreshTokenRepository(s),
    ))

    register_command_handler(UpdateProfile, lambda s: UpdateProfileHandler(
        user_repo=SqlAlchemyUserRepository(s),
        membership_repo=SqlAlchemyMembershipRepository(s),
        role_repo=SqlAlchemyRoleRepository(s),
    ))

    # ── Auth Queries ──

    register_query_handler(GetCurrentUser, lambda s: GetCurrentUserHandler(
        user_repo=SqlAlchemyUserRepository(s),
        membership_repo=SqlAlchemyMembershipRepository(s),
        role_repo=SqlAlchemyRoleRepository(s),
    ))

    # ── Tenant Commands ──

    register_command_handler(CreateTenant, lambda s: CreateTenantHandler(
        tenant_repo=SqlAlchemyTenantRepository(s),
        role_repo=SqlAlchemyRoleRepository(s),
        privilege_repo=SqlAlchemyPrivilegeRepository(s),
        membership_repo=SqlAlchemyMembershipRepository(s),
    ))

    register_command_handler(InviteMember, lambda s: InviteMemberHandler(
        invitation_repo=SqlAlchemyInvitationRepository(s),
        role_repo=SqlAlchemyRoleRepository(s),
    ))

    register_command_handler(AcceptInvite, lambda s: AcceptInviteHandler(
        invitation_repo=SqlAlchemyInvitationRepository(s),
        membership_repo=SqlAlchemyMembershipRepository(s),
    ))

    register_command_handler(AssignRoles, lambda s: AssignRolesHandler(
        membership_repo=SqlAlchemyMembershipRepository(s),
        role_repo=SqlAlchemyRoleRepository(s),
    ))

    register_command_handler(RevokeRole, lambda s: RevokeRoleHandler(
        membership_repo=SqlAlchemyMembershipRepository(s),
    ))

    register_command_handler(RemoveMember, lambda s: RemoveMemberHandler(
        membership_repo=SqlAlchemyMembershipRepository(s),
        role_repo=SqlAlchemyRoleRepository(s),
    ))

    register_command_handler(CreateRole, lambda s: CreateRoleHandler(
        role_repo=SqlAlchemyRoleRepository(s),
        privilege_repo=SqlAlchemyPrivilegeRepository(s),
    ))

    register_command_handler(UpdateRole, lambda s: UpdateRoleHandler(
        role_repo=SqlAlchemyRoleRepository(s),
        privilege_repo=SqlAlchemyPrivilegeRepository(s),
    ))

    register_command_handler(DeleteRole, lambda s: DeleteRoleHandler(
        role_repo=SqlAlchemyRoleRepository(s),
    ))

    register_command_handler(SetRolePrivileges, lambda s: SetRolePrivilegesHandler(
        role_repo=SqlAlchemyRoleRepository(s),
        privilege_repo=SqlAlchemyPrivilegeRepository(s),
    ))

    register_command_handler(UpdateTenant, lambda s: UpdateTenantHandler(
        tenant_repo=SqlAlchemyTenantRepository(s),
    ))

    register_command_handler(AddRoleToMember, lambda s: AddRoleToMemberHandler(
        membership_repo=SqlAlchemyMembershipRepository(s),
        role_repo=SqlAlchemyRoleRepository(s),
    ))

    # ── Tenant Queries ──

    register_query_handler(ListMyTenants, lambda s: ListMyTenantsHandler(
        membership_repo=SqlAlchemyMembershipRepository(s),
        tenant_repo=SqlAlchemyTenantRepository(s),
        role_repo=SqlAlchemyRoleRepository(s),
    ))

    register_query_handler(ListTenantMembers, lambda s: ListTenantMembersHandler(
        membership_repo=SqlAlchemyMembershipRepository(s),
        role_repo=SqlAlchemyRoleRepository(s),
        user_repo=SqlAlchemyUserRepository(s),
    ))

    register_query_handler(ListTenantRoles, lambda s: ListTenantRolesHandler(
        role_repo=SqlAlchemyRoleRepository(s),
        privilege_repo=SqlAlchemyPrivilegeRepository(s),
    ))

    register_query_handler(GetRole, lambda s: GetRoleHandler(
        role_repo=SqlAlchemyRoleRepository(s),
        privilege_repo=SqlAlchemyPrivilegeRepository(s),
    ))

    register_query_handler(ListPrivileges, lambda s: ListPrivilegesHandler(
        privilege_repo=SqlAlchemyPrivilegeRepository(s),
    ))

    register_query_handler(GetTenant, lambda s: GetTenantHandler(
        tenant_repo=SqlAlchemyTenantRepository(s),
    ))

    register_query_handler(GetMemberRoles, lambda s: GetMemberRolesHandler(
        membership_repo=SqlAlchemyMembershipRepository(s),
        role_repo=SqlAlchemyRoleRepository(s),
    ))

    register_query_handler(GetMemberEffectivePermissions, lambda s: GetMemberEffectivePermissionsHandler(
        membership_repo=SqlAlchemyMembershipRepository(s),
        role_repo=SqlAlchemyRoleRepository(s),
    ))

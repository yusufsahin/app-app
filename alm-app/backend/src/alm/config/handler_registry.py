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
from alm.tenant.application.commands.create_user_by_admin import (
    CreateUserByAdmin,
    CreateUserByAdminHandler,
)
from alm.tenant.application.commands.soft_delete_user import (
    SoftDeleteUser,
    SoftDeleteUserHandler,
)
from alm.tenant.application.commands.accept_invite import AcceptInvite, AcceptInviteHandler
from alm.tenant.application.commands.assign_roles import AssignRoles, AssignRolesHandler
from alm.tenant.application.commands.revoke_role import RevokeRole, RevokeRoleHandler
from alm.tenant.application.commands.remove_member import RemoveMember, RemoveMemberHandler
from alm.tenant.application.commands.create_role import CreateRole, CreateRoleHandler
from alm.tenant.application.commands.update_role import UpdateRole, UpdateRoleHandler
from alm.tenant.application.commands.delete_role import DeleteRole, DeleteRoleHandler
from alm.tenant.application.commands.set_role_privileges import SetRolePrivileges, SetRolePrivilegesHandler
from alm.tenant.application.commands.update_tenant import UpdateTenant, UpdateTenantHandler
from alm.tenant.application.commands.archive_tenant import ArchiveTenant, ArchiveTenantHandler
from alm.tenant.application.commands.add_role_to_member import AddRoleToMember, AddRoleToMemberHandler

# ── Tenant queries ──
from alm.tenant.application.queries.list_tenants import ListMyTenants, ListMyTenantsHandler
from alm.tenant.application.queries.list_members import ListTenantMembers, ListTenantMembersHandler
from alm.tenant.application.queries.list_users_for_admin import (
    ListUsersForAdmin,
    ListUsersForAdminHandler,
)
from alm.tenant.application.queries.list_roles import ListTenantRoles, ListTenantRolesHandler
from alm.tenant.application.queries.get_role import GetRole, GetRoleHandler
from alm.tenant.application.queries.list_privileges import ListPrivileges, ListPrivilegesHandler
from alm.tenant.application.queries.get_tenant import GetTenant, GetTenantHandler
from alm.tenant.application.queries.get_tenant_by_slug import (
    GetTenantBySlug,
    GetTenantBySlugHandler,
)
from alm.tenant.application.queries.get_member_roles import GetMemberRoles, GetMemberRolesHandler
from alm.tenant.application.queries.get_member_permissions import (
    GetMemberEffectivePermissions,
    GetMemberEffectivePermissionsHandler,
)

# ── Audit queries ──
from alm.shared.audit.queries import GetEntityHistory, GetEntityHistoryHandler

# ── Project commands ──
from alm.project.application.commands.create_project import CreateProject, CreateProjectHandler
from alm.project.application.commands.update_project import UpdateProject, UpdateProjectHandler
from alm.project.application.commands.update_project_manifest import (
    UpdateProjectManifest,
    UpdateProjectManifestHandler,
)
from alm.project.application.commands.add_project_member import (
    AddProjectMember,
    AddProjectMemberHandler,
)
from alm.project.application.commands.remove_project_member import (
    RemoveProjectMember,
    RemoveProjectMemberHandler,
)
from alm.project.application.commands.update_project_member import (
    UpdateProjectMember,
    UpdateProjectMemberHandler,
)
from alm.project.application.queries.list_project_members import (
    ListProjectMembers,
    ListProjectMembersHandler,
)

# ── Project queries ──
from alm.project.application.queries.list_projects import ListProjects, ListProjectsHandler
from alm.project.application.queries.get_project import GetProject, GetProjectHandler
from alm.project.application.queries.get_org_dashboard_stats import (
    GetOrgDashboardStats,
    GetOrgDashboardStatsHandler,
)
from alm.project.application.queries.get_org_dashboard_activity import (
    GetOrgDashboardActivity,
    GetOrgDashboardActivityHandler,
)
from alm.project.application.queries.get_project_manifest import (
    GetProjectManifest,
    GetProjectManifestHandler,
)
from alm.project.application.queries.get_velocity import (
    GetVelocity,
    GetVelocityHandler,
)
from alm.project.application.queries.get_burndown import (
    GetBurndown,
    GetBurndownHandler,
)
from alm.form_schema.application.queries.get_form_schema import (
    GetFormSchema,
    GetFormSchemaHandler,
)
from alm.form_schema.application.queries.get_list_schema import (
    GetListSchema,
    GetListSchemaHandler,
)

# ── Artifact commands ──
from alm.artifact.application.commands.create_artifact import (
    CreateArtifact,
    CreateArtifactHandler,
)
from alm.artifact.application.commands.transition_artifact import (
    TransitionArtifact,
    TransitionArtifactHandler,
)
from alm.artifact.application.commands.update_artifact import (
    UpdateArtifact,
    UpdateArtifactHandler,
)
from alm.artifact.application.commands.delete_artifact import (
    DeleteArtifact,
    DeleteArtifactHandler,
)
from alm.artifact.application.commands.restore_artifact import (
    RestoreArtifact,
    RestoreArtifactHandler,
)

# ── Artifact queries ──
from alm.artifact.application.queries.list_artifacts import (
    ListArtifacts,
    ListArtifactsHandler,
)
from alm.artifact.application.queries.get_artifact import GetArtifact, GetArtifactHandler
from alm.artifact.application.queries.get_permitted_transitions import (
    GetPermittedTransitions,
    GetPermittedTransitionsHandler,
)

# ── Task commands ──
from alm.task.application.commands.create_task import CreateTask, CreateTaskHandler
from alm.task.application.commands.update_task import UpdateTask, UpdateTaskHandler
from alm.task.application.commands.delete_task import DeleteTask, DeleteTaskHandler
# ── Task queries ──
from alm.task.application.queries.list_tasks_by_artifact import (
    ListTasksByArtifact,
    ListTasksByArtifactHandler,
)
from alm.task.application.queries.get_task import GetTask, GetTaskHandler

# ── Comment commands ──
from alm.comment.application.commands.create_comment import CreateComment, CreateCommentHandler
# ── Comment queries ──
from alm.comment.application.queries.list_comments_by_artifact import (
    ListCommentsByArtifact,
    ListCommentsByArtifactHandler,
)

# ── Artifact link (traceability) commands ──
from alm.artifact_link.application.commands.create_artifact_link import (
    CreateArtifactLink,
    CreateArtifactLinkHandler,
)
from alm.artifact_link.application.commands.delete_artifact_link import (
    DeleteArtifactLink,
    DeleteArtifactLinkHandler,
)
# ── Artifact link queries ──
from alm.artifact_link.application.queries.list_artifact_links import (
    ListArtifactLinks,
    ListArtifactLinksHandler,
)

# ── Attachment commands ──
from alm.attachment.application.commands.create_attachment import (
    CreateAttachment,
    CreateAttachmentHandler,
)
from alm.attachment.application.commands.delete_attachment import (
    DeleteAttachment,
    DeleteAttachmentHandler,
)
# ── Attachment queries ──
from alm.attachment.application.queries.list_attachments_by_artifact import (
    ListAttachmentsByArtifact,
    ListAttachmentsByArtifactHandler,
)
from alm.attachment.application.queries.get_attachment import (
    GetAttachment,
    GetAttachmentHandler,
)

# ── Saved query commands ──
from alm.saved_query.application.commands.create_saved_query import (
    CreateSavedQuery,
    CreateSavedQueryHandler,
)
from alm.saved_query.application.commands.update_saved_query import (
    UpdateSavedQuery,
    UpdateSavedQueryHandler,
)
from alm.saved_query.application.commands.delete_saved_query import (
    DeleteSavedQuery,
    DeleteSavedQueryHandler,
)
# ── Saved query queries ──
from alm.saved_query.application.queries.list_saved_queries import (
    ListSavedQueries,
    ListSavedQueriesHandler,
)
from alm.saved_query.application.queries.get_saved_query import (
    GetSavedQuery,
    GetSavedQueryHandler,
)

# ── Workflow rule commands ──
from alm.workflow_rule.application.commands.create_workflow_rule import (
    CreateWorkflowRule,
    CreateWorkflowRuleHandler,
)
from alm.workflow_rule.application.commands.update_workflow_rule import (
    UpdateWorkflowRule,
    UpdateWorkflowRuleHandler,
)
from alm.workflow_rule.application.commands.delete_workflow_rule import (
    DeleteWorkflowRule,
    DeleteWorkflowRuleHandler,
)
# ── Workflow rule queries ──
from alm.workflow_rule.application.queries.list_workflow_rules import (
    ListWorkflowRules,
    ListWorkflowRulesHandler,
)
from alm.workflow_rule.application.queries.get_workflow_rule import (
    GetWorkflowRule,
    GetWorkflowRuleHandler,
)

# ── Cycle (planning tree) commands ──
from alm.cycle.application.commands.create_cycle import CreateCycleNode, CreateCycleNodeHandler
from alm.cycle.application.commands.update_cycle import UpdateCycleNode, UpdateCycleNodeHandler
from alm.cycle.application.commands.delete_cycle import DeleteCycleNode, DeleteCycleNodeHandler
# ── Cycle queries ──
from alm.cycle.application.queries.list_cycles_by_project import (
    ListCycleNodesByProject,
    ListCycleNodesByProjectHandler,
)
from alm.cycle.application.queries.get_cycle import GetCycleNode, GetCycleNodeHandler

# ── Area (project area tree) commands ──
from alm.area.application.commands.create_area import CreateAreaNode, CreateAreaNodeHandler
from alm.area.application.commands.update_area import UpdateAreaNode, UpdateAreaNodeHandler
from alm.area.application.commands.delete_area import DeleteAreaNode, DeleteAreaNodeHandler
from alm.area.application.commands.rename_area import RenameAreaNode, RenameAreaNodeHandler
from alm.area.application.commands.move_area import MoveAreaNode, MoveAreaNodeHandler
from alm.area.application.commands.activate_area import ActivateAreaNode, ActivateAreaNodeHandler
from alm.area.application.commands.deactivate_area import DeactivateAreaNode, DeactivateAreaNodeHandler
# ── Area queries ──
from alm.area.application.queries.list_areas_by_project import (
    ListAreaNodesByProject,
    ListAreaNodesByProjectHandler,
)
from alm.area.application.queries.get_area import GetAreaNode, GetAreaNodeHandler

# ── Team (P6) commands ──
from alm.team.application.commands.create_team import CreateTeam, CreateTeamHandler
from alm.team.application.commands.update_team import UpdateTeam, UpdateTeamHandler
from alm.team.application.commands.delete_team import DeleteTeam, DeleteTeamHandler
from alm.team.application.commands.add_team_member import AddTeamMember, AddTeamMemberHandler
from alm.team.application.commands.remove_team_member import RemoveTeamMember, RemoveTeamMemberHandler
# ── Team queries ──
from alm.team.application.queries.list_teams_by_project import (
    ListTeamsByProject,
    ListTeamsByProjectHandler,
)
from alm.team.application.queries.get_team import GetTeam, GetTeamHandler

# ── Process template queries ──
from alm.process_template.application.queries.list_process_templates import (
    ListProcessTemplates,
    ListProcessTemplatesHandler,
)
from alm.process_template.application.queries.get_process_template import (
    GetProcessTemplate,
    GetProcessTemplateHandler,
)
from alm.process_template.application.queries.get_process_template_version import (
    GetProcessTemplateVersion,
    GetProcessTemplateVersionHandler,
)

# ── Repository imports ──
from alm.auth.infrastructure.repositories import (
    SqlAlchemyRefreshTokenRepository,
    SqlAlchemyUserLookupAdapter,
    SqlAlchemyUserRepository,
)
from alm.tenant.infrastructure.repositories import (
    SqlAlchemyTenantRepository,
    SqlAlchemyMembershipRepository,
    SqlAlchemyRoleRepository,
    SqlAlchemyPrivilegeRepository,
    SqlAlchemyInvitationRepository,
)
from alm.project.infrastructure.repositories import SqlAlchemyProjectRepository
from alm.project.infrastructure.project_member_repository import (
    SqlAlchemyProjectMemberRepository,
)
from alm.artifact.infrastructure.repositories import SqlAlchemyArtifactRepository
from alm.process_template.infrastructure.repositories import (
    SqlAlchemyProcessTemplateRepository,
)
from alm.task.infrastructure.repositories import SqlAlchemyTaskRepository
from alm.comment.infrastructure.repositories import SqlAlchemyCommentRepository
from alm.artifact_link.infrastructure.repositories import SqlAlchemyArtifactLinkRepository
from alm.attachment.infrastructure.repositories import SqlAlchemyAttachmentRepository
from alm.attachment.infrastructure.file_storage import LocalFileStorage
from alm.saved_query.infrastructure.repositories import SqlAlchemySavedQueryRepository
from alm.workflow_rule.infrastructure.repositories import SqlAlchemyWorkflowRuleRepository
from alm.config.settings import settings
from alm.cycle.infrastructure.repositories import SqlAlchemyCycleRepository
from alm.area.infrastructure.repositories import SqlAlchemyAreaRepository
from alm.team.infrastructure.repositories import SqlAlchemyTeamRepository
from alm.tenant.domain.services import TenantOnboardingSaga

# DDD Enterprise Clean Architecture: Domain Event Dispatcher
from alm.shared.application.mediator import set_domain_event_dispatcher
from alm.shared.infrastructure.event_dispatcher import (
    DomainEventDispatcher,
    register_event_handler,
)
from alm.artifact.domain.events import ArtifactCreated, ArtifactStateChanged
from alm.artifact.application.event_handlers import (
    on_artifact_created,
    on_artifact_state_changed,
)
from alm.workflow_rule.application.event_handlers import (
    on_artifact_created_workflow_rules,
    on_artifact_state_changed_workflow_rules,
)
from alm.realtime.event_handlers import on_artifact_state_changed_realtime


def register_all_handlers() -> None:
    # DDD Enterprise Clean Architecture: wire Domain Event Dispatcher
    dispatcher = DomainEventDispatcher()
    register_event_handler(ArtifactCreated, on_artifact_created)
    register_event_handler(ArtifactStateChanged, on_artifact_state_changed)
    register_event_handler(ArtifactCreated, on_artifact_created_workflow_rules)
    register_event_handler(ArtifactStateChanged, on_artifact_state_changed_workflow_rules)
    register_event_handler(ArtifactStateChanged, on_artifact_state_changed_realtime)
    set_domain_event_dispatcher(dispatcher)

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
        tenant_repo=SqlAlchemyTenantRepository(s),
        user_lookup=SqlAlchemyUserLookupAdapter(s),
    ))

    register_command_handler(CreateUserByAdmin, lambda s: CreateUserByAdminHandler(
        user_repo=SqlAlchemyUserRepository(s),
        membership_repo=SqlAlchemyMembershipRepository(s),
        role_repo=SqlAlchemyRoleRepository(s),
        tenant_repo=SqlAlchemyTenantRepository(s),
    ))

    register_command_handler(SoftDeleteUser, lambda s: SoftDeleteUserHandler(
        user_repo=SqlAlchemyUserRepository(s),
        membership_repo=SqlAlchemyMembershipRepository(s),
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

    register_command_handler(ArchiveTenant, lambda s: ArchiveTenantHandler(
        tenant_repo=SqlAlchemyTenantRepository(s),
        membership_repo=SqlAlchemyMembershipRepository(s),
        role_repo=SqlAlchemyRoleRepository(s),
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
        user_lookup=SqlAlchemyUserLookupAdapter(s),
    ))

    register_query_handler(ListUsersForAdmin, lambda s: ListUsersForAdminHandler(
        membership_repo=SqlAlchemyMembershipRepository(s),
        role_repo=SqlAlchemyRoleRepository(s),
        user_lookup=SqlAlchemyUserLookupAdapter(s),
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

    register_query_handler(GetTenantBySlug, lambda s: GetTenantBySlugHandler(
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

    # ── Project Commands ──

    register_command_handler(CreateProject, lambda s: CreateProjectHandler(
        project_repo=SqlAlchemyProjectRepository(s),
        process_template_repo=SqlAlchemyProcessTemplateRepository(s),
        project_member_repo=SqlAlchemyProjectMemberRepository(s),
    ))
    register_command_handler(UpdateProject, lambda s: UpdateProjectHandler(
        project_repo=SqlAlchemyProjectRepository(s),
    ))
    register_command_handler(UpdateProjectManifest, lambda s: UpdateProjectManifestHandler(
        project_repo=SqlAlchemyProjectRepository(s),
        process_template_repo=SqlAlchemyProcessTemplateRepository(s),
    ))

    register_command_handler(AddProjectMember, lambda s: AddProjectMemberHandler(
        project_repo=SqlAlchemyProjectRepository(s),
        project_member_repo=SqlAlchemyProjectMemberRepository(s),
    ))
    register_command_handler(RemoveProjectMember, lambda s: RemoveProjectMemberHandler(
        project_repo=SqlAlchemyProjectRepository(s),
        project_member_repo=SqlAlchemyProjectMemberRepository(s),
    ))
    register_command_handler(UpdateProjectMember, lambda s: UpdateProjectMemberHandler(
        project_repo=SqlAlchemyProjectRepository(s),
        project_member_repo=SqlAlchemyProjectMemberRepository(s),
    ))

    # ── Project Queries ──

    register_query_handler(ListProjects, lambda s: ListProjectsHandler(
        project_repo=SqlAlchemyProjectRepository(s),
    ))

    register_query_handler(GetProject, lambda s: GetProjectHandler(
        project_repo=SqlAlchemyProjectRepository(s),
    ))

    register_query_handler(GetVelocity, lambda s: GetVelocityHandler(
        project_repo=SqlAlchemyProjectRepository(s),
        cycle_repo=SqlAlchemyCycleRepository(s),
        artifact_repo=SqlAlchemyArtifactRepository(s),
    ))

    register_query_handler(GetBurndown, lambda s: GetBurndownHandler(
        project_repo=SqlAlchemyProjectRepository(s),
        cycle_repo=SqlAlchemyCycleRepository(s),
        artifact_repo=SqlAlchemyArtifactRepository(s),
    ))

    register_query_handler(GetOrgDashboardStats, lambda s: GetOrgDashboardStatsHandler(
        project_repo=SqlAlchemyProjectRepository(s),
        artifact_repo=SqlAlchemyArtifactRepository(s),
        task_repo=SqlAlchemyTaskRepository(s),
    ))

    register_query_handler(GetOrgDashboardActivity, lambda s: GetOrgDashboardActivityHandler(
        project_repo=SqlAlchemyProjectRepository(s),
        artifact_repo=SqlAlchemyArtifactRepository(s),
    ))

    register_query_handler(ListProjectMembers, lambda s: ListProjectMembersHandler(
        project_repo=SqlAlchemyProjectRepository(s),
        project_member_repo=SqlAlchemyProjectMemberRepository(s),
    ))

    register_query_handler(GetProjectManifest, lambda s: GetProjectManifestHandler(
        project_repo=SqlAlchemyProjectRepository(s),
        process_template_repo=SqlAlchemyProcessTemplateRepository(s),
    ))
    register_query_handler(GetListSchema, lambda s: GetListSchemaHandler(
        project_repo=SqlAlchemyProjectRepository(s),
        process_template_repo=SqlAlchemyProcessTemplateRepository(s),
    ))
    register_query_handler(GetFormSchema, lambda s: GetFormSchemaHandler(
        project_repo=SqlAlchemyProjectRepository(s),
        process_template_repo=SqlAlchemyProcessTemplateRepository(s),
    ))

    # ── Artifact commands ──
    register_command_handler(CreateArtifact, lambda s: CreateArtifactHandler(
        artifact_repo=SqlAlchemyArtifactRepository(s),
        project_repo=SqlAlchemyProjectRepository(s),
        process_template_repo=SqlAlchemyProcessTemplateRepository(s),
        area_repo=SqlAlchemyAreaRepository(s),
    ))
    register_command_handler(TransitionArtifact, lambda s: TransitionArtifactHandler(
        artifact_repo=SqlAlchemyArtifactRepository(s),
        project_repo=SqlAlchemyProjectRepository(s),
        process_template_repo=SqlAlchemyProcessTemplateRepository(s),
    ))
    register_command_handler(UpdateArtifact, lambda s: UpdateArtifactHandler(
        artifact_repo=SqlAlchemyArtifactRepository(s),
        project_repo=SqlAlchemyProjectRepository(s),
        area_repo=SqlAlchemyAreaRepository(s),
    ))
    register_command_handler(DeleteArtifact, lambda s: DeleteArtifactHandler(
        artifact_repo=SqlAlchemyArtifactRepository(s),
        project_repo=SqlAlchemyProjectRepository(s),
    ))
    register_command_handler(RestoreArtifact, lambda s: RestoreArtifactHandler(
        artifact_repo=SqlAlchemyArtifactRepository(s),
        project_repo=SqlAlchemyProjectRepository(s),
    ))

    # ── Artifact queries ──
    register_query_handler(ListArtifacts, lambda s: ListArtifactsHandler(
        artifact_repo=SqlAlchemyArtifactRepository(s),
        project_repo=SqlAlchemyProjectRepository(s),
    ))
    register_query_handler(GetArtifact, lambda s: GetArtifactHandler(
        artifact_repo=SqlAlchemyArtifactRepository(s),
        project_repo=SqlAlchemyProjectRepository(s),
    ))
    register_query_handler(GetPermittedTransitions, lambda s: GetPermittedTransitionsHandler(
        artifact_repo=SqlAlchemyArtifactRepository(s),
        project_repo=SqlAlchemyProjectRepository(s),
        process_template_repo=SqlAlchemyProcessTemplateRepository(s),
    ))

    # ── Task commands ──
    register_command_handler(CreateTask, lambda s: CreateTaskHandler(
        task_repo=SqlAlchemyTaskRepository(s),
        artifact_repo=SqlAlchemyArtifactRepository(s),
        project_repo=SqlAlchemyProjectRepository(s),
    ))
    register_command_handler(UpdateTask, lambda s: UpdateTaskHandler(
        task_repo=SqlAlchemyTaskRepository(s),
    ))
    register_command_handler(DeleteTask, lambda s: DeleteTaskHandler(
        task_repo=SqlAlchemyTaskRepository(s),
    ))
    # ── Task queries ──
    register_query_handler(ListTasksByArtifact, lambda s: ListTasksByArtifactHandler(
        task_repo=SqlAlchemyTaskRepository(s),
    ))
    register_query_handler(GetTask, lambda s: GetTaskHandler(
        task_repo=SqlAlchemyTaskRepository(s),
    ))

    # ── Comment commands ──
    register_command_handler(CreateComment, lambda s: CreateCommentHandler(
        comment_repo=SqlAlchemyCommentRepository(s),
        artifact_repo=SqlAlchemyArtifactRepository(s),
        project_repo=SqlAlchemyProjectRepository(s),
    ))
    # ── Comment queries ──
    register_query_handler(ListCommentsByArtifact, lambda s: ListCommentsByArtifactHandler(
        comment_repo=SqlAlchemyCommentRepository(s),
        artifact_repo=SqlAlchemyArtifactRepository(s),
        project_repo=SqlAlchemyProjectRepository(s),
    ))

    # ── Artifact link (traceability) ──
    register_command_handler(CreateArtifactLink, lambda s: CreateArtifactLinkHandler(
        link_repo=SqlAlchemyArtifactLinkRepository(s),
        artifact_repo=SqlAlchemyArtifactRepository(s),
        project_repo=SqlAlchemyProjectRepository(s),
    ))
    register_command_handler(DeleteArtifactLink, lambda s: DeleteArtifactLinkHandler(
        link_repo=SqlAlchemyArtifactLinkRepository(s),
    ))
    register_query_handler(ListArtifactLinks, lambda s: ListArtifactLinksHandler(
        link_repo=SqlAlchemyArtifactLinkRepository(s),
    ))

    # ── Attachment (file storage) ──
    _file_storage = LocalFileStorage(settings.upload_dir)
    register_command_handler(CreateAttachment, lambda s: CreateAttachmentHandler(
        attachment_repo=SqlAlchemyAttachmentRepository(s),
        storage=_file_storage,
        artifact_repo=SqlAlchemyArtifactRepository(s),
        project_repo=SqlAlchemyProjectRepository(s),
    ))
    register_command_handler(DeleteAttachment, lambda s: DeleteAttachmentHandler(
        attachment_repo=SqlAlchemyAttachmentRepository(s),
        storage=_file_storage,
    ))
    register_query_handler(ListAttachmentsByArtifact, lambda s: ListAttachmentsByArtifactHandler(
        attachment_repo=SqlAlchemyAttachmentRepository(s),
    ))
    register_query_handler(GetAttachment, lambda s: GetAttachmentHandler(
        attachment_repo=SqlAlchemyAttachmentRepository(s),
    ))

    # ── Saved queries ──
    register_command_handler(CreateSavedQuery, lambda s: CreateSavedQueryHandler(
        saved_query_repo=SqlAlchemySavedQueryRepository(s),
        project_repo=SqlAlchemyProjectRepository(s),
    ))
    register_command_handler(UpdateSavedQuery, lambda s: UpdateSavedQueryHandler(
        saved_query_repo=SqlAlchemySavedQueryRepository(s),
    ))
    register_command_handler(DeleteSavedQuery, lambda s: DeleteSavedQueryHandler(
        saved_query_repo=SqlAlchemySavedQueryRepository(s),
    ))
    register_query_handler(ListSavedQueries, lambda s: ListSavedQueriesHandler(
        saved_query_repo=SqlAlchemySavedQueryRepository(s),
    ))
    register_query_handler(GetSavedQuery, lambda s: GetSavedQueryHandler(
        saved_query_repo=SqlAlchemySavedQueryRepository(s),
    ))

    # ── Workflow rules ──
    register_command_handler(CreateWorkflowRule, lambda s: CreateWorkflowRuleHandler(
        workflow_rule_repo=SqlAlchemyWorkflowRuleRepository(s),
        project_repo=SqlAlchemyProjectRepository(s),
    ))
    register_command_handler(UpdateWorkflowRule, lambda s: UpdateWorkflowRuleHandler(
        workflow_rule_repo=SqlAlchemyWorkflowRuleRepository(s),
    ))
    register_command_handler(DeleteWorkflowRule, lambda s: DeleteWorkflowRuleHandler(
        workflow_rule_repo=SqlAlchemyWorkflowRuleRepository(s),
    ))
    register_query_handler(ListWorkflowRules, lambda s: ListWorkflowRulesHandler(
        workflow_rule_repo=SqlAlchemyWorkflowRuleRepository(s),
    ))
    register_query_handler(GetWorkflowRule, lambda s: GetWorkflowRuleHandler(
        workflow_rule_repo=SqlAlchemyWorkflowRuleRepository(s),
    ))

    # ── Cycle (planning tree) commands ──
    register_command_handler(CreateCycleNode, lambda s: CreateCycleNodeHandler(
        cycle_repo=SqlAlchemyCycleRepository(s),
        project_repo=SqlAlchemyProjectRepository(s),
    ))
    register_command_handler(UpdateCycleNode, lambda s: UpdateCycleNodeHandler(
        cycle_repo=SqlAlchemyCycleRepository(s),
        project_repo=SqlAlchemyProjectRepository(s),
    ))
    register_command_handler(DeleteCycleNode, lambda s: DeleteCycleNodeHandler(
        cycle_repo=SqlAlchemyCycleRepository(s),
        project_repo=SqlAlchemyProjectRepository(s),
    ))
    # ── Cycle queries ──
    register_query_handler(ListCycleNodesByProject, lambda s: ListCycleNodesByProjectHandler(
        cycle_repo=SqlAlchemyCycleRepository(s),
        project_repo=SqlAlchemyProjectRepository(s),
    ))
    register_query_handler(GetCycleNode, lambda s: GetCycleNodeHandler(
        cycle_repo=SqlAlchemyCycleRepository(s),
        project_repo=SqlAlchemyProjectRepository(s),
    ))

    # ── Area (project area tree) ──
    register_command_handler(CreateAreaNode, lambda s: CreateAreaNodeHandler(
        area_repo=SqlAlchemyAreaRepository(s),
        project_repo=SqlAlchemyProjectRepository(s),
    ))
    register_command_handler(UpdateAreaNode, lambda s: UpdateAreaNodeHandler(
        area_repo=SqlAlchemyAreaRepository(s),
        project_repo=SqlAlchemyProjectRepository(s),
    ))
    register_command_handler(DeleteAreaNode, lambda s: DeleteAreaNodeHandler(
        area_repo=SqlAlchemyAreaRepository(s),
        project_repo=SqlAlchemyProjectRepository(s),
    ))
    register_command_handler(RenameAreaNode, lambda s: RenameAreaNodeHandler(
        area_repo=SqlAlchemyAreaRepository(s),
        project_repo=SqlAlchemyProjectRepository(s),
    ))
    register_command_handler(MoveAreaNode, lambda s: MoveAreaNodeHandler(
        area_repo=SqlAlchemyAreaRepository(s),
        project_repo=SqlAlchemyProjectRepository(s),
    ))
    register_command_handler(ActivateAreaNode, lambda s: ActivateAreaNodeHandler(
        area_repo=SqlAlchemyAreaRepository(s),
        project_repo=SqlAlchemyProjectRepository(s),
    ))
    register_command_handler(DeactivateAreaNode, lambda s: DeactivateAreaNodeHandler(
        area_repo=SqlAlchemyAreaRepository(s),
        project_repo=SqlAlchemyProjectRepository(s),
    ))
    register_query_handler(ListAreaNodesByProject, lambda s: ListAreaNodesByProjectHandler(
        area_repo=SqlAlchemyAreaRepository(s),
        project_repo=SqlAlchemyProjectRepository(s),
    ))
    register_query_handler(GetAreaNode, lambda s: GetAreaNodeHandler(
        area_repo=SqlAlchemyAreaRepository(s),
        project_repo=SqlAlchemyProjectRepository(s),
    ))

    # ── Team (P6) ──
    register_command_handler(CreateTeam, lambda s: CreateTeamHandler(
        team_repo=SqlAlchemyTeamRepository(s),
        project_repo=SqlAlchemyProjectRepository(s),
    ))
    register_command_handler(UpdateTeam, lambda s: UpdateTeamHandler(
        team_repo=SqlAlchemyTeamRepository(s),
        project_repo=SqlAlchemyProjectRepository(s),
    ))
    register_command_handler(DeleteTeam, lambda s: DeleteTeamHandler(
        team_repo=SqlAlchemyTeamRepository(s),
        project_repo=SqlAlchemyProjectRepository(s),
    ))
    register_command_handler(AddTeamMember, lambda s: AddTeamMemberHandler(
        team_repo=SqlAlchemyTeamRepository(s),
        project_repo=SqlAlchemyProjectRepository(s),
    ))
    register_command_handler(RemoveTeamMember, lambda s: RemoveTeamMemberHandler(
        team_repo=SqlAlchemyTeamRepository(s),
        project_repo=SqlAlchemyProjectRepository(s),
    ))
    register_query_handler(ListTeamsByProject, lambda s: ListTeamsByProjectHandler(
        team_repo=SqlAlchemyTeamRepository(s),
        project_repo=SqlAlchemyProjectRepository(s),
    ))
    register_query_handler(GetTeam, lambda s: GetTeamHandler(
        team_repo=SqlAlchemyTeamRepository(s),
        project_repo=SqlAlchemyProjectRepository(s),
    ))

    # ── Process template queries ──
    register_query_handler(ListProcessTemplates, lambda s: ListProcessTemplatesHandler(
        repo=SqlAlchemyProcessTemplateRepository(s),
    ))
    register_query_handler(GetProcessTemplate, lambda s: GetProcessTemplateHandler(
        repo=SqlAlchemyProcessTemplateRepository(s),
    ))
    register_query_handler(GetProcessTemplateVersion, lambda s: GetProcessTemplateVersionHandler(
        repo=SqlAlchemyProcessTemplateRepository(s),
    ))

    # ── Audit Queries ──

    from alm.shared.audit.repository import SqlAlchemyAuditReader
    register_query_handler(GetEntityHistory, lambda s: GetEntityHistoryHandler(
        audit_reader=SqlAlchemyAuditReader(s),
    ))

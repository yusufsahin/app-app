"""Shared imports for orgs API route modules (wildcard import)."""

from __future__ import annotations

import uuid

from fastapi import Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

from alm.area.api.schemas import (
    AreaNodeCreateRequest,
    AreaNodeResponse,
    AreaNodeUpdateRequest,
    MoveAreaRequest,
    RenameAreaRequest,
)
from alm.area.application.commands.activate_area import ActivateAreaNode
from alm.area.application.commands.create_area import CreateAreaNode
from alm.area.application.commands.deactivate_area import DeactivateAreaNode
from alm.area.application.commands.delete_area import DeleteAreaNode
from alm.area.application.commands.move_area import MoveAreaNode
from alm.area.application.commands.rename_area import RenameAreaNode
from alm.area.application.commands.update_area import UpdateAreaNode
from alm.area.application.queries.get_area import GetAreaNode
from alm.area.application.queries.list_areas_by_project import ListAreaNodesByProject
from alm.artifact.api.schemas import (
    ArtifactCreateRequest,
    ArtifactExportResponse,
    ArtifactImportResponse,
    ArtifactListResponse,
    ArtifactResponse,
    ArtifactTransitionRequest,
    ArtifactUpdateRequest,
    BatchDeleteRequest,
    BatchResultResponse,
    BatchTransitionRequest,
    PermittedTransitionItem,
    PermittedTransitionsResponse,
    artifact_response_from_dto,
)
from alm.artifact.application.commands.create_artifact import CreateArtifact
from alm.artifact.application.commands.delete_artifact import DeleteArtifact
from alm.artifact.application.commands.restore_artifact import RestoreArtifact
from alm.artifact.application.commands.transition_artifact import TransitionArtifact
from alm.artifact.application.commands.update_artifact import UpdateArtifact
from alm.artifact.application.queries.get_artifact import GetArtifact
from alm.artifact.application.queries.get_permitted_transitions import GetPermittedTransitions
from alm.artifact.application.queries.list_artifacts import ListArtifacts
from alm.artifact.domain.mpc_resolver import manifest_defs_to_flat
from alm.attachment.api.schemas import AttachmentResponse
from alm.attachment.application.commands.create_attachment import CreateAttachment
from alm.attachment.application.commands.delete_attachment import DeleteAttachment
from alm.attachment.application.queries.get_attachment import GetAttachment
from alm.attachment.application.queries.list_attachments_by_artifact import ListAttachmentsByArtifact
from alm.attachment.domain.ports import FileStoragePort
from alm.capacity.api.schemas import (
    CapacityCreateRequest,
    CapacityResponse,
    CapacityUpdateRequest,
    capacity_response_from_dto,
)
from alm.capacity.application.commands.create_capacity import CreateCapacity
from alm.capacity.application.commands.delete_capacity import DeleteCapacity
from alm.capacity.application.commands.update_capacity import UpdateCapacity
from alm.capacity.application.queries.list_capacity_by_project import ListCapacityByProject
from alm.comment.api.schemas import CommentCreateRequest, CommentResponse
from alm.comment.application.commands.create_comment import CreateComment
from alm.comment.application.queries.list_comments_by_artifact import ListCommentsByArtifact
from alm.config.dependencies import get_db, get_file_storage, get_mediator
from alm.cycle.api.schemas import CadenceCreateRequest, CadenceResponse, CadenceUpdateRequest
from alm.cycle.application.commands.create_cycle import CreateCadence
from alm.cycle.application.commands.delete_cycle import DeleteCadence
from alm.cycle.application.commands.update_cycle import UpdateCadence
from alm.cycle.application.queries.get_cycle import GetCadence
from alm.cycle.application.queries.list_cycles_by_project import ListCadencesByProject
from alm.form_schema.api.schemas import (
    FormFieldSchemaResponse,
    FormSchemaResponse,
    ListColumnSchemaResponse,
    ListFilterSchemaResponse,
    ListSchemaResponse,
    LookupSchemaResponse,
)
from alm.form_schema.application.queries.get_form_schema import GetFormSchema
from alm.form_schema.application.queries.get_list_schema import GetListSchema
from alm.project.api.schemas import (
    AddProjectMemberRequest,
    ProjectCreateRequest,
    ProjectMemberResponse,
    ProjectResponse,
    UpdateProjectManifestRequest,
    UpdateProjectMemberRequest,
    UpdateProjectRequest,
)
from alm.project.application.commands.add_project_member import AddProjectMember
from alm.project.application.commands.create_project import CreateProject
from alm.project.application.commands.remove_project_member import RemoveProjectMember
from alm.project.application.commands.update_project import UpdateProject
from alm.project.application.commands.update_project_manifest import UpdateProjectManifest
from alm.project.application.commands.update_project_member import UpdateProjectMember
from alm.project.application.queries.get_burndown import GetBurndown
from alm.project.application.queries.get_org_dashboard_activity import GetOrgDashboardActivity
from alm.project.application.queries.get_org_dashboard_stats import GetOrgDashboardStats
from alm.project.application.queries.get_project import GetProject
from alm.project.application.queries.get_project_manifest import GetProjectManifest
from alm.project.application.queries.get_velocity import GetVelocity
from alm.project.application.queries.list_project_members import ListProjectMembers
from alm.project.application.queries.list_projects import ListProjects
from alm.project_tag.application.commands.create_project_tag import CreateProjectTag
from alm.project_tag.application.commands.delete_project_tag import DeleteProjectTag
from alm.project_tag.application.commands.rename_project_tag import RenameProjectTag
from alm.project_tag.application.queries.list_project_tags import ListProjectTags
from alm.relationship.api.schemas import (
    ArtifactImpactAnalysisNodeResponse,
    ArtifactImpactAnalysisResponse,
    ArtifactRelationshipBulkCreateRequest,
    ArtifactRelationshipBulkDeleteRequest,
    ArtifactRelationshipBulkResultItem,
    ArtifactRelationshipBulkResultResponse,
    ArtifactRelationshipCreateRequest,
    ArtifactRelationshipReorderRequest,
    ArtifactRelationshipResponse,
    ImpactHierarchyRefResponse,
    RelationshipTypeOptionResponse,
)
from alm.relationship.application.commands.create_relationship import CreateRelationship
from alm.relationship.application.commands.delete_relationship import DeleteRelationship
from alm.relationship.application.commands.reorder_relationships import ReorderOutgoingRelationships
from alm.relationship.application.dtos import ArtifactImpactAnalysisNodeDTO
from alm.relationship.application.queries.get_artifact_impact_analysis import GetArtifactImpactAnalysis
from alm.relationship.application.queries.list_relationship_type_options import ListRelationshipTypeOptions
from alm.relationship.application.queries.list_relationships_for_artifact import ListRelationshipsForArtifact
from alm.saved_query.api.schemas import (
    SavedQueryCreateRequest,
    SavedQueryResponse,
    SavedQueryUpdateRequest,
)
from alm.saved_query.application.commands.create_saved_query import CreateSavedQuery
from alm.saved_query.application.commands.delete_saved_query import DeleteSavedQuery
from alm.saved_query.application.commands.update_saved_query import UpdateSavedQuery
from alm.saved_query.application.queries.get_saved_query import GetSavedQuery
from alm.saved_query.application.queries.list_saved_queries import ListSavedQueries
from alm.shared.api.schemas import MessageResponse
from alm.shared.application.mediator import Mediator
from alm.shared.domain.exceptions import (
    ConflictError,
    EntityNotFound,
    GuardDeniedError,
    PolicyDeniedError,
    ValidationError,
)
from alm.shared.infrastructure.org_resolver import ResolvedOrg, resolve_org
from alm.shared.infrastructure.security.dependencies import (
    CurrentUser,
    get_user_privileges,
    require_list_schema_read_permission,
    require_permission,
)
from alm.shared.infrastructure.security.field_masking import (
    allowed_actions_for_artifact,
    mask_artifact_for_user,
    mask_artifact_list_for_user,
)
from alm.shared.infrastructure.security.manifest_acl import require_manifest_acl
from alm.task.api.schemas import (
    TaskCreateRequest,
    TaskReorderRequest,
    TaskResponse,
    TaskUpdateRequest,
    task_response_from_dto,
)
from alm.task.application.commands.create_task import CreateTask
from alm.task.application.commands.delete_task import DeleteTask
from alm.task.application.commands.reorder_artifact_tasks import ReorderArtifactTasks
from alm.task.application.commands.update_task import UpdateTask
from alm.task.application.queries.get_task import GetTask
from alm.task.application.queries.list_tasks_by_artifact import ListTasksByArtifact
from alm.task.application.queries.list_tasks_by_project_and_assignee import (
    ListTasksByProjectAndAssignee,
)
from alm.team.api.schemas import (
    AddTeamMemberRequest,
    TeamCreateRequest,
    TeamMemberResponse,
    TeamResponse,
    TeamUpdateRequest,
)
from alm.team.application.commands.add_team_member import AddTeamMember
from alm.team.application.commands.create_team import CreateTeam
from alm.team.application.commands.delete_team import DeleteTeam
from alm.team.application.commands.remove_team_member import RemoveTeamMember
from alm.team.application.commands.update_team import UpdateTeam
from alm.team.application.queries.get_team import GetTeam
from alm.team.application.queries.list_teams_by_project import ListTeamsByProject
from alm.tenant.api.schemas import (
    AddRoleRequest,
    AssignRolesRequest,
    CreateRoleRequest,
    InvitationResponse,
    InviteMemberRequest,
    MemberResponse,
    PrivilegeSchema,
    RoleDetailResponse,
    RoleInfoSchema,
    SetRolePrivilegesRequest,
    TenantResponse,
    UpdateRoleRequest,
    UpdateTenantRequest,
)
from alm.tenant.application.commands.assign_roles import AssignRoles
from alm.tenant.application.commands.create_role import CreateRole
from alm.tenant.application.commands.delete_role import DeleteRole
from alm.tenant.application.commands.invite_member import InviteMember
from alm.tenant.application.commands.remove_member import RemoveMember
from alm.tenant.application.commands.revoke_role import RevokeRole
from alm.tenant.application.commands.set_role_privileges import SetRolePrivileges
from alm.tenant.application.commands.update_role import UpdateRole
from alm.tenant.application.commands.update_tenant import UpdateTenant
from alm.tenant.application.dtos import (
    InvitationDTO,
    MemberDTO,
    PrivilegeDTO,
    RoleDetailDTO,
    TenantDTO,
)
from alm.tenant.application.queries.get_member_roles import GetMemberRoles
from alm.tenant.application.queries.get_role import GetRole
from alm.tenant.application.queries.list_members import ListTenantMembers
from alm.tenant.application.queries.list_roles import ListTenantRoles
from alm.workflow_rule.api.schemas import (
    WorkflowRuleCreateRequest,
    WorkflowRuleResponse,
    WorkflowRuleUpdateRequest,
)
from alm.workflow_rule.application.commands.create_workflow_rule import CreateWorkflowRule
from alm.workflow_rule.application.commands.delete_workflow_rule import DeleteWorkflowRule
from alm.workflow_rule.application.commands.update_workflow_rule import UpdateWorkflowRule
from alm.workflow_rule.application.queries.get_workflow_rule import GetWorkflowRule
from alm.workflow_rule.application.queries.list_workflow_rules import ListWorkflowRules

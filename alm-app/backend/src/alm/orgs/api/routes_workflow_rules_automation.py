"""Org API routes: Workflow rules (automation)."""

from fastapi import APIRouter

from alm.orgs.api._router_deps import *  # noqa: F403

router = APIRouter()

# ── Workflow rules (automation) ──


def _workflow_rule_dto_to_response(dto) -> WorkflowRuleResponse:
    return WorkflowRuleResponse(
        id=dto.id,
        project_id=dto.project_id,
        name=dto.name,
        trigger_event_type=dto.trigger_event_type,
        condition_expression=dto.condition_expression,
        actions=dto.actions,
        is_active=dto.is_active,
        created_at=dto.created_at,
        updated_at=dto.updated_at,
    )


@router.get(
    "/projects/{project_id}/workflow-rules",
    response_model=list[WorkflowRuleResponse],
)
async def list_workflow_rules(
    project_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:read"),
    mediator: Mediator = Depends(get_mediator),
) -> list[WorkflowRuleResponse]:
    dtos = await mediator.query(ListWorkflowRules(tenant_id=org.tenant_id, project_id=project_id))
    return [_workflow_rule_dto_to_response(d) for d in dtos]


@router.post(
    "/projects/{project_id}/workflow-rules",
    response_model=WorkflowRuleResponse,
    status_code=201,
)
async def create_workflow_rule(
    project_id: uuid.UUID,
    body: WorkflowRuleCreateRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:update"),
    mediator: Mediator = Depends(get_mediator),
) -> WorkflowRuleResponse:
    dto = await mediator.send(
        CreateWorkflowRule(
            tenant_id=org.tenant_id,
            project_id=project_id,
            name=body.name,
            trigger_event_type=body.trigger_event_type,
            actions=body.actions,
            condition_expression=body.condition_expression,
            is_active=body.is_active,
        )
    )
    return _workflow_rule_dto_to_response(dto)


@router.get(
    "/projects/{project_id}/workflow-rules/{rule_id}",
    response_model=WorkflowRuleResponse,
)
async def get_workflow_rule(
    project_id: uuid.UUID,
    rule_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:read"),
    mediator: Mediator = Depends(get_mediator),
) -> WorkflowRuleResponse:
    dto = await mediator.query(
        GetWorkflowRule(
            tenant_id=org.tenant_id,
            project_id=project_id,
            rule_id=rule_id,
        )
    )
    if dto is None:
        raise EntityNotFound("WorkflowRule", rule_id)
    return _workflow_rule_dto_to_response(dto)


@router.put(
    "/projects/{project_id}/workflow-rules/{rule_id}",
    response_model=WorkflowRuleResponse,
)
async def update_workflow_rule(
    project_id: uuid.UUID,
    rule_id: uuid.UUID,
    body: WorkflowRuleUpdateRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:update"),
    mediator: Mediator = Depends(get_mediator),
) -> WorkflowRuleResponse:
    dto = await mediator.send(
        UpdateWorkflowRule(
            tenant_id=org.tenant_id,
            project_id=project_id,
            rule_id=rule_id,
            name=body.name,
            trigger_event_type=body.trigger_event_type,
            condition_expression=body.condition_expression,
            actions=body.actions,
            is_active=body.is_active,
        )
    )
    return _workflow_rule_dto_to_response(dto)


@router.delete(
    "/projects/{project_id}/workflow-rules/{rule_id}",
    status_code=204,
)
async def delete_workflow_rule(
    project_id: uuid.UUID,
    rule_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:update"),
    mediator: Mediator = Depends(get_mediator),
) -> None:
    await mediator.send(
        DeleteWorkflowRule(
            tenant_id=org.tenant_id,
            project_id=project_id,
            rule_id=rule_id,
        )
    )

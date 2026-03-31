"""Quality: resolve backend-owned execution configuration for a test in a run."""

from __future__ import annotations

from fastapi import APIRouter

from alm.orgs.api._router_deps import *  # noqa: F403
from alm.quality.api.schemas import (
    ResolveExecutionConfigOptionItem,
    ResolveExecutionConfigRequest,
    ResolveExecutionConfigResponse,
    ResolveExecutionConfigStepItem,
)
from alm.quality.application.queries.resolve_test_execution_config import ResolveTestExecutionConfig

router = APIRouter()


@router.post(
    "/projects/{project_id}/quality/execution-config/resolve",
    response_model=ResolveExecutionConfigResponse,
)
async def resolve_execution_config(
    project_id: uuid.UUID,
    body: ResolveExecutionConfigRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:read"),
    _acl: None = require_manifest_acl("artifact", "read"),
    mediator: Mediator = Depends(get_mediator),
) -> ResolveExecutionConfigResponse:
    dto = await mediator.query(
        ResolveTestExecutionConfig(
            tenant_id=org.tenant_id,
            project_id=project_id,
            run_id=body.run_id,
            test_id=body.test_id,
            configuration_id=body.configuration_id,
        )
    )
    return ResolveExecutionConfigResponse(
        test_id=dto.test_id,
        configuration_id=dto.configuration_id,
        configuration_name=dto.configuration_name,
        available_configurations=[
            ResolveExecutionConfigOptionItem(
                id=item.id,
                name=item.name,
                is_default=item.is_default,
            )
            for item in dto.available_configurations
        ],
        resolved_values=dto.resolved_values,
        unresolved_params=dto.unresolved_params,
        warnings=dto.warnings,
        steps=[
            ResolveExecutionConfigStepItem(
                id=step.id,
                step_number=step.step_number,
                name=step.name,
                description=step.description,
                expected_result=step.expected_result,
                status=step.status,
            )
            for step in dto.steps
        ],
    )

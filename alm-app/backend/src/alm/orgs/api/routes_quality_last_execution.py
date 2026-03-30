"""Quality: batch last execution status for test cases."""

from __future__ import annotations

import uuid

from fastapi import APIRouter

from alm.orgs.api._router_deps import *  # noqa: F403
from alm.quality.api.schemas import (
    LastExecutionStatusItem,
    LastExecutionStatusRequest,
    LastExecutionStatusResponse,
    LastExecutionStepStatusItem,
)
from alm.quality.application.queries.batch_last_test_execution_status import (
    BatchLastTestExecutionStatus,
)

router = APIRouter()


@router.post(
    "/projects/{project_id}/quality/last-execution-status",
    response_model=LastExecutionStatusResponse,
)
async def batch_last_execution_status(
    project_id: uuid.UUID,
    body: LastExecutionStatusRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:read"),
    _acl: None = require_manifest_acl("artifact", "read"),
    mediator: Mediator = Depends(get_mediator),
) -> LastExecutionStatusResponse:
    dtos = await mediator.query(
        BatchLastTestExecutionStatus(
            tenant_id=org.tenant_id,
            project_id=project_id,
            test_ids=body.test_ids,
        )
    )
    items = [
        LastExecutionStatusItem(
            test_id=d.test_id,
            status=d.status,
            run_id=d.run_id,
            run_title=d.run_title,
            run_updated_at=d.run_updated_at,
            param_row_index=d.param_row_index,
            step_results=[
                LastExecutionStepStatusItem(step_id=s.step_id, status=s.status) for s in d.step_results
            ],
        )
        for d in dtos
    ]
    return LastExecutionStatusResponse(items=items)

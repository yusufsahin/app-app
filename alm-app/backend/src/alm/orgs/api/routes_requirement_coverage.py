"""Requirement tree coverage analysis (verifies + last execution rollups)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, Query

from alm.orgs.api._router_deps import *  # noqa: F403
from alm.quality.api.schemas import (
    RequirementCoverageAnalysisResponse,
    RequirementCoverageLeafResponse,
    RequirementCoverageNodeResponse,
    RequirementCoverageTestRefResponse,
)
from alm.quality.application.queries.requirement_coverage_analysis import (
    RequirementCoverageAnalysis,
)
from alm.shared.domain.exceptions import ValidationError

router = APIRouter()


@router.get(
    "/projects/{project_id}/requirements/coverage-analysis",
    response_model=RequirementCoverageAnalysisResponse,
)
async def get_requirement_coverage_analysis(
    project_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:read"),
    _acl: None = require_manifest_acl("artifact", "read"),
    mediator: Mediator = Depends(get_mediator),
    under: uuid.UUID | None = Query(None, description="Subtree root artifact id"),
    link_types: str | None = Query(
        None,
        description="Comma-separated link types (default: verifies)",
    ),
    include_reverse_verifies: bool = Query(
        True,
        description="Also count verifies links from requirement to test-case",
    ),
    scope_run_id: uuid.UUID | None = None,
    scope_suite_id: uuid.UUID | None = None,
    scope_campaign_id: uuid.UUID | None = None,
    refresh: bool = Query(False, description="Bypass short-lived server cache"),
) -> RequirementCoverageAnalysisResponse:
    scopes = sum(
        1 for x in (scope_run_id, scope_suite_id, scope_campaign_id) if x is not None
    )
    if scopes > 1:
        raise HTTPException(
            status_code=422,
            detail="At most one of scope_run_id, scope_suite_id, scope_campaign_id",
        )
    lt_raw = (link_types or "verifies").strip()
    lt_tuple = tuple(s.strip() for s in lt_raw.split(",") if s.strip())
    if not lt_tuple:
        lt_tuple = ("verifies",)
    try:
        result = await mediator.query(
            RequirementCoverageAnalysis(
                tenant_id=org.tenant_id,
                project_id=project_id,
                under_artifact_id=under,
                link_types=lt_tuple,
                include_reverse_verifies=include_reverse_verifies,
                scope_run_id=scope_run_id,
                scope_suite_id=scope_suite_id,
                scope_campaign_id=scope_campaign_id,
                refresh=refresh,
            )
        )
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return RequirementCoverageAnalysisResponse(
        computed_at=result.computed_at,
        cache_hit=result.cache_hit,
        nodes=[
            RequirementCoverageNodeResponse(
                id=n.id,
                parent_id=n.parent_id,
                title=n.title,
                artifact_key=n.artifact_key,
                artifact_type=n.artifact_type,
                direct_status=n.direct_status,
                subtree_counts=n.subtree_counts,
            )
            for n in result.nodes
        ],
        leaves=[
            RequirementCoverageLeafResponse(
                id=leaf.id,
                parent_id=leaf.parent_id,
                title=leaf.title,
                artifact_key=leaf.artifact_key,
                leaf_status=leaf.leaf_status,
                verifying_test_ids=leaf.verifying_test_ids,
                tests=[
                    RequirementCoverageTestRefResponse(
                        test_id=t.test_id,
                        status=t.status,
                        run_id=t.run_id,
                        run_title=t.run_title,
                    )
                    for t in leaf.tests
                ],
            )
            for leaf in result.leaves
        ],
    )

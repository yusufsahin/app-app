"""Single-shot AI content generation routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from alm.ai.api.schemas import GenerateArtifactRequest, GeneratedArtifactResponse
from alm.ai.application.commands.generate_artifact_content import GenerateArtifactContent
from alm.config.dependencies import get_mediator
from alm.config.settings import settings
from alm.shared.application.mediator import Mediator
from alm.shared.domain.exceptions import PolicyDeniedError
from alm.shared.infrastructure.org_resolver import ResolvedOrg, resolve_org
from alm.shared.infrastructure.security.dependencies import CurrentUser, require_permission

router = APIRouter()


@router.post("/ai/generate", response_model=GeneratedArtifactResponse)
async def generate_artifact_content(
    body: GenerateArtifactRequest,
    org: ResolvedOrg = Depends(resolve_org),
    _user: CurrentUser = require_permission("artifact:create"),
    mediator: Mediator = Depends(get_mediator),
) -> GeneratedArtifactResponse:
    if not settings.enable_ai_features:
        raise PolicyDeniedError("AI features are disabled")
    dto = await mediator.send(
        GenerateArtifactContent(
            tenant_id=org.tenant_id,
            project_id=body.project_id,
            title=body.title,
            artifact_type=body.artifact_type,
            description_hint=body.description_hint,
            provider_config_id=body.provider_config_id,
        )
    )
    return GeneratedArtifactResponse(
        description=dto.description,
        acceptance_criteria=dto.acceptance_criteria,
        test_cases=dto.test_cases,
    )

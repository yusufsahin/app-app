from __future__ import annotations

from alm.project.api.public_settings import (
    deploy_webhook_secret_configured,
    redact_sensitive_project_settings,
    scm_webhook_secret_configured_flags,
)
from alm.project.api.schemas import ProjectResponse
from alm.project.application.dtos import ProjectDTO


def project_dto_to_response(dto: ProjectDTO) -> ProjectResponse:
    gh, gl = scm_webhook_secret_configured_flags(dto.settings)
    dep = deploy_webhook_secret_configured(dto.settings)
    return ProjectResponse(
        id=dto.id,
        code=dto.code,
        name=dto.name,
        slug=dto.slug,
        description=dto.description,
        status=dto.status,
        settings=redact_sensitive_project_settings(dto.settings),
        metadata=dto.metadata_,
        scm_webhook_github_secret_configured=gh,
        scm_webhook_gitlab_secret_configured=gl,
        deploy_webhook_secret_configured=dep,
    )

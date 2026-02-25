"""Process template API router."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends

from alm.config.dependencies import get_mediator
from alm.shared.application.mediator import Mediator
from alm.shared.domain.exceptions import EntityNotFound
from alm.shared.infrastructure.security.dependencies import require_permission
from alm.process_template.application.queries.get_process_template import GetProcessTemplate
from alm.process_template.application.queries.get_process_template_version import (
    GetProcessTemplateVersion,
)
from alm.process_template.application.queries.list_process_templates import (
    ListProcessTemplates,
)

router = APIRouter(prefix="/process-templates", tags=["process-templates"])


@router.get("/")
async def list_process_templates(
    user=require_permission("project:read"),
    mediator: Mediator = Depends(get_mediator),
) -> list[dict]:
    """List all available process templates (global catalog)."""
    templates = await mediator.query(ListProcessTemplates())
    return [
        {
            "id": str(t.id),
            "slug": t.slug,
            "name": t.name,
            "is_builtin": t.is_builtin,
            "description": t.description,
            "type": t.type,
            "configuration": t.configuration,
        }
        for t in templates
    ]


@router.get("/{template_id}")
async def get_process_template(
    template_id: uuid.UUID,
    user=require_permission("project:read"),
    mediator: Mediator = Depends(get_mediator),
) -> dict:
    """Get a process template by ID."""
    template = await mediator.query(GetProcessTemplate(template_id=template_id))
    if template is None:
        raise EntityNotFound("ProcessTemplate", template_id)
    return {
        "id": str(template.id),
        "slug": template.slug,
        "name": template.name,
        "is_builtin": template.is_builtin,
        "description": template.description,
        "type": template.type,
        "configuration": template.configuration,
    }


@router.get("/versions/{version_id}")
async def get_process_template_version(
    version_id: uuid.UUID,
    user=require_permission("project:read"),
    mediator: Mediator = Depends(get_mediator),
) -> dict:
    """Get a process template version by ID (includes manifest_bundle)."""
    version = await mediator.query(GetProcessTemplateVersion(version_id=version_id))
    if version is None:
        raise EntityNotFound("ProcessTemplateVersion", version_id)
    return {
        "id": str(version.id),
        "template_id": str(version.template_id),
        "version": version.version,
        "manifest_bundle": version.manifest_bundle,
    }

"""Admin/provider management routes for AI providers."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends

from alm.ai.api.schemas import ProviderConfigResponse, UpsertProviderRequest
from alm.ai.application.dtos import AiProviderConfigDTO
from alm.ai.application.commands.upsert_provider_config import UpsertProviderConfig
from alm.ai.infrastructure.repositories import SqlAlchemyAiRepository
from alm.config.dependencies import get_db, get_mediator
from alm.config.settings import settings
from alm.shared.application.mediator import Mediator
from alm.shared.api.schemas import MessageResponse
from alm.shared.domain.exceptions import PolicyDeniedError
from alm.shared.infrastructure.org_resolver import ResolvedOrg, resolve_org
from alm.shared.infrastructure.security.dependencies import CurrentUser, require_permission
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


@router.get("/ai/providers", response_model=list[ProviderConfigResponse])
async def list_providers(
    org: ResolvedOrg = Depends(resolve_org),
    _user: CurrentUser = require_permission("tenant:update"),
    db: AsyncSession = Depends(get_db),
) -> list[ProviderConfigResponse]:
    if not settings.enable_ai_features:
        raise PolicyDeniedError("AI features are disabled")
    repo = SqlAlchemyAiRepository(db)
    providers = await repo.list_provider_configs(org.tenant_id)
    return [
        ProviderConfigResponse(
            id=p.id,
            tenant_id=p.tenant_id,
            name=p.name,
            provider=p.provider,
            model=p.model,
            base_url=p.base_url,
            is_default=p.is_default,
            is_enabled=p.is_enabled,
            has_api_key=bool(p.encrypted_api_key),
            created_at=p.created_at,
            updated_at=p.updated_at,
        )
        for p in providers
    ]


@router.post("/ai/providers", response_model=ProviderConfigResponse, status_code=201)
async def create_provider(
    body: UpsertProviderRequest,
    org: ResolvedOrg = Depends(resolve_org),
    _user: CurrentUser = require_permission("tenant:update"),
    mediator: Mediator = Depends(get_mediator),
) -> ProviderConfigResponse:
    dto = await mediator.send(
        UpsertProviderConfig(
            tenant_id=org.tenant_id,
            provider_id=None,
            name=body.name,
            provider=body.provider,
            model=body.model,
            api_key=body.api_key,
            base_url=body.base_url,
            is_default=body.is_default,
            is_enabled=body.is_enabled,
        )
    )
    return _provider_response(dto)


@router.put("/ai/providers/{provider_id}", response_model=ProviderConfigResponse)
async def update_provider(
    provider_id: uuid.UUID,
    body: UpsertProviderRequest,
    org: ResolvedOrg = Depends(resolve_org),
    _user: CurrentUser = require_permission("tenant:update"),
    mediator: Mediator = Depends(get_mediator),
) -> ProviderConfigResponse:
    dto = await mediator.send(
        UpsertProviderConfig(
            tenant_id=org.tenant_id,
            provider_id=provider_id,
            name=body.name,
            provider=body.provider,
            model=body.model,
            api_key=body.api_key,
            base_url=body.base_url,
            is_default=body.is_default,
            is_enabled=body.is_enabled,
        )
    )
    return _provider_response(dto)


@router.delete("/ai/providers/{provider_id}", response_model=MessageResponse)
async def delete_provider(
    provider_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    _user: CurrentUser = require_permission("tenant:update"),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    repo = SqlAlchemyAiRepository(db)
    provider = await repo.get_provider_config(provider_id)
    if provider and provider.tenant_id == org.tenant_id:
        await repo.delete_provider_config(provider_id)
    return MessageResponse(message="Provider deleted")


def _provider_response(dto: AiProviderConfigDTO) -> ProviderConfigResponse:
    return ProviderConfigResponse(
        id=dto.id,
        tenant_id=dto.tenant_id,
        name=dto.name,
        provider=dto.provider,
        model=dto.model,
        base_url=dto.base_url,
        is_default=dto.is_default,
        is_enabled=dto.is_enabled,
        has_api_key=dto.has_api_key,
        created_at=dto.created_at,
        updated_at=dto.updated_at,
    )

"""Create/update AI provider configs."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.ai.application.dtos import AiProviderConfigDTO
from alm.ai.domain.entities import AiProviderConfig
from alm.ai.domain.ports import IAiRepository
from alm.ai.infrastructure.crypto import encrypt_api_key
from alm.config.settings import settings
from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ValidationError


@dataclass(frozen=True)
class UpsertProviderConfig(Command):
    tenant_id: uuid.UUID
    provider_id: uuid.UUID | None
    name: str
    provider: str
    model: str
    api_key: str | None = None
    base_url: str | None = None
    is_default: bool = False
    is_enabled: bool = True


class UpsertProviderConfigHandler(CommandHandler[AiProviderConfigDTO]):
    def __init__(self, repo: IAiRepository) -> None:
        self._repo = repo

    async def handle(self, command: Command) -> AiProviderConfigDTO:
        assert isinstance(command, UpsertProviderConfig)
        if settings.is_production and settings.ai_encryption_key.strip() == "":
            raise ValidationError("AI encryption key must be configured in production")
        if command.name.strip() == "":
            raise ValidationError("Provider name is required")
        if command.provider.strip() == "" or command.model.strip() == "":
            raise ValidationError("Provider and model are required")

        existing = None
        if command.provider_id is not None:
            existing = await self._repo.get_provider_config(command.provider_id)

        if existing:
            encrypted_api_key = existing.encrypted_api_key
            if command.api_key is not None:
                encrypted_api_key = encrypt_api_key(command.api_key)
            entity = AiProviderConfig(
                id=existing.id,
                tenant_id=command.tenant_id,
                name=command.name.strip(),
                provider=command.provider.strip().lower(),
                model=command.model.strip(),
                encrypted_api_key=encrypted_api_key,
                base_url=(command.base_url or "").strip() or None,
                is_default=command.is_default,
                is_enabled=command.is_enabled,
                created_at=existing.created_at,
                updated_at=existing.updated_at,
            )
        else:
            entity = AiProviderConfig.create(
                tenant_id=command.tenant_id,
                name=command.name.strip(),
                provider=command.provider.strip().lower(),
                model=command.model.strip(),
                encrypted_api_key=encrypt_api_key(command.api_key or ""),
                base_url=(command.base_url or "").strip() or None,
                is_default=command.is_default,
            )
            entity.is_enabled = command.is_enabled

        if entity.is_default:
            configs = await self._repo.list_provider_configs(command.tenant_id)
            for cfg in configs:
                if cfg.id != entity.id and cfg.is_default:
                    cfg.is_default = False
                    await self._repo.save_provider_config(cfg)

        saved = await self._repo.save_provider_config(entity)
        return AiProviderConfigDTO(
            id=saved.id,
            tenant_id=saved.tenant_id,
            name=saved.name,
            provider=saved.provider,
            model=saved.model,
            base_url=saved.base_url,
            is_default=saved.is_default,
            is_enabled=saved.is_enabled,
            has_api_key=bool(saved.encrypted_api_key),
            created_at=saved.created_at,
            updated_at=saved.updated_at,
        )

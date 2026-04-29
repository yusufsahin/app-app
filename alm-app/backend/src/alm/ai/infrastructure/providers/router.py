"""Provider selection and fallback helpers."""

from __future__ import annotations

import uuid
from typing import Any

from alm.ai.domain.ports import IAiRepository, ILlmProvider
from alm.ai.infrastructure.providers.litellm_adapter import build_provider
from alm.shared.domain.exceptions import ValidationError


class ProviderRouter:
    def __init__(self, repo: IAiRepository, tenant_id: uuid.UUID) -> None:
        self._repo = repo
        self._tenant_id = tenant_id

    async def get_primary_and_fallbacks(
        self,
        provider_config_id: uuid.UUID | None,
    ) -> tuple[ILlmProvider, str, list[tuple[ILlmProvider, str]]]:
        configs = await self._repo.list_provider_configs(self._tenant_id)
        enabled = [c for c in configs if c.is_enabled]
        if not enabled:
            raise ValidationError("No enabled AI provider configuration found")

        selected = None
        if provider_config_id is not None:
            selected = next((c for c in enabled if c.id == provider_config_id), None)
        if selected is None:
            selected = next((c for c in enabled if c.is_default), None) or enabled[0]

        primary = (build_provider(selected), selected.provider)
        fallbacks = [(build_provider(c), c.provider) for c in enabled if c.id != selected.id]
        return primary[0], primary[1], fallbacks

    async def complete_with_fallback(
        self,
        provider_config_id: uuid.UUID | None,
        *,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
        stream: bool = False,
    ) -> tuple[Any, str]:
        primary, provider_name, fallbacks = await self.get_primary_and_fallbacks(provider_config_id)
        try:
            return await primary.complete(messages=messages, tools=tools, stream=stream), provider_name
        except Exception:
            for fallback, fallback_name in fallbacks:
                try:
                    return (
                        await fallback.complete(messages=messages, tools=tools, stream=stream),
                        fallback_name,
                    )
                except Exception:
                    continue
            raise

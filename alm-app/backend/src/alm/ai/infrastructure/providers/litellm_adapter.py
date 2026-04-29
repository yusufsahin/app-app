"""LiteLLM adapter — unified interface for all LLM providers."""

from __future__ import annotations

from typing import Any, AsyncIterator

from alm.ai.domain.entities import AiProviderConfig
from alm.ai.domain.ports import ILlmProvider
from alm.ai.infrastructure.crypto import decrypt_api_key
from alm.shared.domain.exceptions import ValidationError

try:
    import litellm
except ModuleNotFoundError:  # pragma: no cover - environment specific
    litellm = None

# Silence LiteLLM's verbose startup logging
if litellm is not None:
    litellm.suppress_debug_info = True

# Provider slug → LiteLLM model prefix map
_PREFIX_MAP: dict[str, str] = {
    "anthropic": "anthropic",
    "openai": "",          # OpenAI needs no prefix in LiteLLM
    "azure": "azure",
    "ollama": "ollama",
    "mistral": "mistral",
    "deepseek": "deepseek",
    "groq": "groq",
    "cohere": "cohere",
    "huggingface": "huggingface",
    "vertex_ai": "vertex_ai",
    "bedrock": "bedrock",
}


def _resolve_model(provider: str, model: str) -> str:
    prefix = _PREFIX_MAP.get(provider.lower(), provider.lower())
    return f"{prefix}/{model}" if prefix else model


class LiteLLMAdapter(ILlmProvider):
    """Wraps litellm.acompletion to support 100+ providers with a single interface."""

    def __init__(self, config: AiProviderConfig) -> None:
        self._model = _resolve_model(config.provider, config.model)
        self._api_key = decrypt_api_key(config.encrypted_api_key) or None
        self._base_url = config.base_url or None

    async def complete(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
        stream: bool = False,
    ) -> Any:
        if litellm is None:
            raise ValidationError("LiteLLM dependency is not installed")
        kwargs: dict[str, Any] = {
            "model": self._model,
            "messages": messages,
            "stream": stream,
        }
        if tools:
            kwargs["tools"] = tools
        if self._api_key:
            kwargs["api_key"] = self._api_key
        if self._base_url:
            kwargs["api_base"] = self._base_url
        return await litellm.acompletion(**kwargs)

    async def stream(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
    ) -> AsyncIterator[Any]:
        if litellm is None:
            raise ValidationError("LiteLLM dependency is not installed")
        kwargs: dict[str, Any] = {
            "model": self._model,
            "messages": messages,
            "stream": True,
        }
        if tools:
            kwargs["tools"] = tools
        if self._api_key:
            kwargs["api_key"] = self._api_key
        if self._base_url:
            kwargs["api_base"] = self._base_url
        response = await litellm.acompletion(**kwargs)
        async for chunk in response:
            yield chunk


def build_provider(config: AiProviderConfig) -> LiteLLMAdapter:
    return LiteLLMAdapter(config)

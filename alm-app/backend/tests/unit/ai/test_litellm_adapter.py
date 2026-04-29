from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, patch

import pytest

from alm.ai.domain.entities import AiProviderConfig

pytest.importorskip("litellm")

from alm.ai.infrastructure.providers.litellm_adapter import LiteLLMAdapter


@pytest.mark.asyncio
async def test_complete_resolves_prefixed_model_and_uses_api_base() -> None:
    cfg = AiProviderConfig.create(
        tenant_id=uuid.uuid4(),
        name="ollama-local",
        provider="ollama",
        model="llama3",
        encrypted_api_key="",
        base_url="http://localhost:11434",
    )
    adapter = LiteLLMAdapter(cfg)

    with patch("alm.ai.infrastructure.providers.litellm_adapter.litellm.acompletion", new=AsyncMock()) as mock_call:
        await adapter.complete(messages=[{"role": "user", "content": "hi"}], tools=None, stream=False)

    assert mock_call.await_count == 1
    kwargs = mock_call.await_args.kwargs
    assert kwargs["model"] == "ollama/llama3"
    assert kwargs["api_base"] == "http://localhost:11434"

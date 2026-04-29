"""AI domain port (interface) definitions."""

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from typing import Any, AsyncIterator

from alm.ai.domain.entities import AiConversation, AiInsight, AiMessage, AiPendingAction, AiProviderConfig
from alm.ai.domain.value_objects import PendingActionStatus


class ILlmProvider(ABC):
    """Unified LLM completion interface — implemented by LiteLLM adapter."""

    @abstractmethod
    async def complete(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
        stream: bool = False,
    ) -> Any:
        """Non-streaming completion — returns LiteLLM ModelResponse."""

    @abstractmethod
    async def stream(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
    ) -> AsyncIterator[Any]:
        """Streaming completion — yields LiteLLM stream chunks."""


class IAiRepository(ABC):
    """Persistence port for all AI aggregates."""

    # ── Provider configs ──
    @abstractmethod
    async def get_provider_config(self, config_id: uuid.UUID) -> AiProviderConfig | None: ...

    @abstractmethod
    async def get_default_provider_config(self, tenant_id: uuid.UUID) -> AiProviderConfig | None: ...

    @abstractmethod
    async def list_provider_configs(self, tenant_id: uuid.UUID) -> list[AiProviderConfig]: ...

    @abstractmethod
    async def save_provider_config(self, config: AiProviderConfig) -> AiProviderConfig: ...

    @abstractmethod
    async def delete_provider_config(self, config_id: uuid.UUID) -> None: ...

    # ── Conversations ──
    @abstractmethod
    async def get_conversation(self, conversation_id: uuid.UUID) -> AiConversation | None: ...

    @abstractmethod
    async def list_conversations(
        self,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID,
        project_id: uuid.UUID | None = None,
    ) -> list[AiConversation]: ...

    @abstractmethod
    async def save_conversation(self, conversation: AiConversation) -> AiConversation: ...

    # ── Messages ──
    @abstractmethod
    async def list_messages(self, conversation_id: uuid.UUID) -> list[AiMessage]: ...

    @abstractmethod
    async def save_message(self, message: AiMessage) -> AiMessage: ...

    # ── Pending actions ──
    @abstractmethod
    async def list_pending_actions(
        self,
        conversation_id: uuid.UUID,
        status: PendingActionStatus | None = None,
    ) -> list[AiPendingAction]: ...

    @abstractmethod
    async def get_pending_action(self, action_id: uuid.UUID) -> AiPendingAction | None: ...

    @abstractmethod
    async def save_pending_action(self, action: AiPendingAction) -> AiPendingAction: ...

    # ── Insights ──
    @abstractmethod
    async def list_insights(
        self,
        tenant_id: uuid.UUID,
        project_id: uuid.UUID,
        include_dismissed: bool = False,
    ) -> list[AiInsight]: ...

    @abstractmethod
    async def save_insight(self, insight: AiInsight) -> AiInsight: ...

    @abstractmethod
    async def dismiss_insight(self, insight_id: uuid.UUID) -> None: ...

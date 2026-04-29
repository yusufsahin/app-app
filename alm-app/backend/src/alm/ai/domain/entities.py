"""AI domain entities."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from alm.ai.domain.value_objects import AutonomyLevel, InsightSeverity, InsightType, MessageRole, PendingActionStatus


@dataclass
class AiProviderConfig:
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    provider: str          # "anthropic", "openai", "azure", "ollama", "mistral", "deepseek", ...
    model: str             # "claude-sonnet-4-6", "gpt-4o", "llama3", ...
    encrypted_api_key: str
    base_url: str | None   # On-premise endpoint (Ollama, vLLM)
    is_default: bool
    is_enabled: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @classmethod
    def create(
        cls,
        tenant_id: uuid.UUID,
        name: str,
        provider: str,
        model: str,
        encrypted_api_key: str,
        base_url: str | None = None,
        is_default: bool = False,
    ) -> AiProviderConfig:
        return cls(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            name=name,
            provider=provider,
            model=model,
            encrypted_api_key=encrypted_api_key,
            base_url=base_url,
            is_default=is_default,
            is_enabled=True,
        )


@dataclass
class AiConversation:
    id: uuid.UUID
    tenant_id: uuid.UUID
    project_id: uuid.UUID | None
    user_id: uuid.UUID
    provider_config_id: uuid.UUID
    autonomy_level: AutonomyLevel
    title: str
    artifact_context_id: uuid.UUID | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @classmethod
    def create(
        cls,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID,
        provider_config_id: uuid.UUID,
        autonomy_level: AutonomyLevel,
        title: str,
        project_id: uuid.UUID | None = None,
        artifact_context_id: uuid.UUID | None = None,
    ) -> AiConversation:
        return cls(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            project_id=project_id,
            user_id=user_id,
            provider_config_id=provider_config_id,
            autonomy_level=autonomy_level,
            title=title,
            artifact_context_id=artifact_context_id,
        )


@dataclass
class AiMessage:
    id: uuid.UUID
    conversation_id: uuid.UUID
    role: MessageRole
    content: str | None
    tool_calls: list[dict[str, Any]] | None = None
    tool_results: list[dict[str, Any]] | None = None
    created_at: datetime | None = None

    @classmethod
    def create(
        cls,
        conversation_id: uuid.UUID,
        role: MessageRole,
        content: str | None = None,
        tool_calls: list[dict[str, Any]] | None = None,
        tool_results: list[dict[str, Any]] | None = None,
    ) -> AiMessage:
        return cls(
            id=uuid.uuid4(),
            conversation_id=conversation_id,
            role=role,
            content=content,
            tool_calls=tool_calls,
            tool_results=tool_results,
        )


@dataclass
class AiPendingAction:
    id: uuid.UUID
    conversation_id: uuid.UUID
    message_id: uuid.UUID
    tool_name: str
    tool_args: dict[str, Any]
    status: PendingActionStatus = PendingActionStatus.PENDING
    executed_result: dict[str, Any] | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @classmethod
    def create(
        cls,
        conversation_id: uuid.UUID,
        message_id: uuid.UUID,
        tool_name: str,
        tool_args: dict[str, Any],
    ) -> AiPendingAction:
        return cls(
            id=uuid.uuid4(),
            conversation_id=conversation_id,
            message_id=message_id,
            tool_name=tool_name,
            tool_args=tool_args,
        )


@dataclass
class AiInsight:
    id: uuid.UUID
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    insight_type: InsightType
    severity: InsightSeverity
    title: str
    body: str
    context: dict[str, Any] = field(default_factory=dict)
    is_dismissed: bool = False
    created_at: datetime | None = None

    @classmethod
    def create(
        cls,
        tenant_id: uuid.UUID,
        project_id: uuid.UUID,
        insight_type: InsightType,
        severity: InsightSeverity,
        title: str,
        body: str,
        context: dict[str, Any] | None = None,
    ) -> AiInsight:
        return cls(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            project_id=project_id,
            insight_type=insight_type,
            severity=severity,
            title=title,
            body=body,
            context=context or {},
        )

"""AI application DTOs."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from alm.ai.domain.value_objects import AutonomyLevel, MessageRole, PendingActionStatus


@dataclass
class AiProviderConfigDTO:
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    provider: str
    model: str
    base_url: str | None
    is_default: bool
    is_enabled: bool
    has_api_key: bool
    created_at: datetime | None
    updated_at: datetime | None


@dataclass
class AiConversationDTO:
    id: uuid.UUID
    tenant_id: uuid.UUID
    project_id: uuid.UUID | None
    user_id: uuid.UUID
    provider_config_id: uuid.UUID
    autonomy_level: AutonomyLevel
    title: str
    artifact_context_id: uuid.UUID | None
    created_at: datetime | None
    updated_at: datetime | None


@dataclass
class AiMessageDTO:
    id: uuid.UUID
    conversation_id: uuid.UUID
    role: MessageRole
    content: str | None
    tool_calls: list[dict[str, Any]] | None
    tool_results: list[dict[str, Any]] | None
    created_at: datetime | None


@dataclass
class AiPendingActionDTO:
    id: uuid.UUID
    conversation_id: uuid.UUID
    message_id: uuid.UUID
    tool_name: str
    tool_args: dict[str, Any]
    status: PendingActionStatus
    executed_result: dict[str, Any] | None
    created_at: datetime | None
    updated_at: datetime | None


@dataclass
class AgentContext:
    tenant_id: uuid.UUID
    project_id: uuid.UUID | None
    user_id: uuid.UUID
    conversation_id: uuid.UUID


@dataclass
class GeneratedArtifactContentDTO:
    description: str
    acceptance_criteria: list[str]
    test_cases: list[str]


@dataclass
class AgentTurnResultDTO:
    conversation: AiConversationDTO
    assistant_message: AiMessageDTO
    pending_actions: list[AiPendingActionDTO]

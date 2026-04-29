"""Pydantic API schemas for AI routes."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class GenerateArtifactRequest(BaseModel):
    project_id: uuid.UUID
    artifact_type: str
    title: str
    description_hint: str | None = None
    provider_config_id: uuid.UUID | None = None


class GeneratedArtifactResponse(BaseModel):
    description: str
    acceptance_criteria: list[str] = Field(default_factory=list)
    test_cases: list[str] = Field(default_factory=list)


class CreateConversationRequest(BaseModel):
    project_id: uuid.UUID | None = None
    first_message: str
    autonomy_level: Literal["suggest", "confirm", "auto"] = "suggest"
    provider_config_id: uuid.UUID | None = None
    artifact_context_id: uuid.UUID | None = None


class CreateMessageRequest(BaseModel):
    content: str


class AiConversationResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID | None
    provider_config_id: uuid.UUID
    autonomy_level: str
    title: str
    artifact_context_id: uuid.UUID | None
    created_at: datetime | None
    updated_at: datetime | None


class AiMessageResponse(BaseModel):
    id: uuid.UUID
    conversation_id: uuid.UUID
    role: str
    content: str | None
    tool_calls: list[dict[str, Any]] | None = None
    tool_results: list[dict[str, Any]] | None = None
    created_at: datetime | None


class AiPendingActionResponse(BaseModel):
    id: uuid.UUID
    conversation_id: uuid.UUID
    message_id: uuid.UUID
    tool_name: str
    tool_args: dict[str, Any]
    status: str
    executed_result: dict[str, Any] | None
    created_at: datetime | None
    updated_at: datetime | None


class AgentTurnResponse(BaseModel):
    conversation: AiConversationResponse
    assistant_message: AiMessageResponse
    pending_actions: list[AiPendingActionResponse]


class UpsertProviderRequest(BaseModel):
    name: str
    provider: str
    model: str
    api_key: str | None = None
    base_url: str | None = None
    is_default: bool = False
    is_enabled: bool = True


class ProviderConfigResponse(BaseModel):
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


class InsightResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    insight_type: str
    severity: str
    title: str
    body: str
    context: dict[str, Any]
    is_dismissed: bool
    created_at: datetime | None

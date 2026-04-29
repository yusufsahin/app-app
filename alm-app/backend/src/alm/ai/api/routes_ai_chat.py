"""Conversation and pending-action routes for AI assistant."""

from __future__ import annotations

import uuid
import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from alm.ai.api.schemas import (
    AgentTurnResponse,
    AiConversationResponse,
    AiMessageResponse,
    AiPendingActionResponse,
    CreateConversationRequest,
    CreateMessageRequest,
)
from alm.ai.application.policy import AiPolicyEvaluator
from alm.ai.application.commands.execute_pending_action import ExecutePendingAction
from alm.ai.application.commands.run_agent_turn import RunAgentTurn
from alm.ai.application.queries.get_conversation import GetConversation
from alm.ai.application.queries.list_conversations import ListConversations
from alm.ai.domain.value_objects import AutonomyLevel
from alm.config.dependencies import get_mediator
from alm.config.settings import settings
from alm.shared.application.mediator import Mediator
from alm.shared.domain.exceptions import EntityNotFound, PolicyDeniedError
from alm.shared.infrastructure.org_resolver import ResolvedOrg, resolve_org
from alm.shared.infrastructure.security.dependencies import CurrentUser, require_permission

router = APIRouter()
_policy = AiPolicyEvaluator()


@router.post("/ai/conversations", response_model=AgentTurnResponse)
async def create_conversation(
    body: CreateConversationRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:read"),
    mediator: Mediator = Depends(get_mediator),
) -> AgentTurnResponse:
    return await _run_turn(
        mediator,
        org.tenant_id,
        user.id,
        body.project_id,
        body.first_message,
        body.autonomy_level,
        conversation_id=None,
        provider_config_id=body.provider_config_id,
        artifact_context_id=body.artifact_context_id,
    )


@router.post("/ai/conversations/{conversation_id}/messages", response_model=AgentTurnResponse)
async def send_conversation_message(
    conversation_id: uuid.UUID,
    body: CreateMessageRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:read"),
    mediator: Mediator = Depends(get_mediator),
) -> AgentTurnResponse:
    return await _run_turn(
        mediator,
        org.tenant_id,
        user.id,
        project_id=None,
        content=body.content,
        autonomy_level="suggest",
        conversation_id=conversation_id,
        provider_config_id=None,
        artifact_context_id=None,
    )


@router.post("/ai/conversations/{conversation_id}/messages/stream")
async def stream_conversation_message(
    conversation_id: uuid.UUID,
    body: CreateMessageRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:read"),
    mediator: Mediator = Depends(get_mediator),
) -> StreamingResponse:
    if not settings.enable_ai_features:
        raise PolicyDeniedError("AI features are disabled")
    _policy.validate_user_content(body.content)

    async def _event_stream():
        try:
            result = await _run_turn(
                mediator,
                org.tenant_id,
                user.id,
                project_id=None,
                content=body.content,
                autonomy_level="suggest",
                conversation_id=conversation_id,
                provider_config_id=None,
                artifact_context_id=None,
            )
            yield f"event: final\ndata: {json.dumps(result.model_dump(mode='json'), default=str)}\n\n"
        except Exception as exc:
            payload = {"message": str(exc)}
            yield f"event: error\ndata: {json.dumps(payload)}\n\n"

    return StreamingResponse(_event_stream(), media_type="text/event-stream")


@router.get("/ai/conversations", response_model=list[AiConversationResponse])
async def list_conversations(
    project_id: uuid.UUID | None = None,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:read"),
    mediator: Mediator = Depends(get_mediator),
) -> list[AiConversationResponse]:
    if not settings.enable_ai_features:
        raise PolicyDeniedError("AI features are disabled")
    dtos = await mediator.query(
        ListConversations(
            tenant_id=org.tenant_id,
            user_id=user.id,
            project_id=project_id,
        )
    )
    return [
        AiConversationResponse(
            id=d.id,
            project_id=d.project_id,
            provider_config_id=d.provider_config_id,
            autonomy_level=d.autonomy_level.value,
            title=d.title,
            artifact_context_id=d.artifact_context_id,
            created_at=d.created_at,
            updated_at=d.updated_at,
        )
        for d in dtos
    ]


@router.get("/ai/conversations/{conversation_id}")
async def get_conversation(
    conversation_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    _user: CurrentUser = require_permission("artifact:read"),
    mediator: Mediator = Depends(get_mediator),
) -> dict:
    if not settings.enable_ai_features:
        raise PolicyDeniedError("AI features are disabled")
    result = await mediator.query(
        GetConversation(tenant_id=org.tenant_id, conversation_id=conversation_id)
    )
    if result is None:
        raise EntityNotFound("Conversation not found")
    return {
        "conversation": AiConversationResponse(
            id=result.conversation.id,
            project_id=result.conversation.project_id,
            provider_config_id=result.conversation.provider_config_id,
            autonomy_level=result.conversation.autonomy_level.value,
            title=result.conversation.title,
            artifact_context_id=result.conversation.artifact_context_id,
            created_at=result.conversation.created_at,
            updated_at=result.conversation.updated_at,
        ),
        "messages": [
            AiMessageResponse(
                id=m.id,
                conversation_id=m.conversation_id,
                role=m.role.value,
                content=m.content,
                tool_calls=m.tool_calls,
                tool_results=m.tool_results,
                created_at=m.created_at,
            )
            for m in result.messages
        ],
        "pending_actions": [
            AiPendingActionResponse(
                id=p.id,
                conversation_id=p.conversation_id,
                message_id=p.message_id,
                tool_name=p.tool_name,
                tool_args=p.tool_args,
                status=p.status.value,
                executed_result=p.executed_result,
                created_at=p.created_at,
                updated_at=p.updated_at,
            )
            for p in result.pending_actions
        ],
    }


@router.get("/ai/conversations/{conversation_id}/pending-actions", response_model=list[AiPendingActionResponse])
async def list_pending_actions(
    conversation_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    _user: CurrentUser = require_permission("artifact:read"),
    mediator: Mediator = Depends(get_mediator),
) -> list[AiPendingActionResponse]:
    result = await mediator.query(
        GetConversation(tenant_id=org.tenant_id, conversation_id=conversation_id)
    )
    if result is None:
        raise EntityNotFound("Conversation not found")
    return [
        AiPendingActionResponse(
            id=p.id,
            conversation_id=p.conversation_id,
            message_id=p.message_id,
            tool_name=p.tool_name,
            tool_args=p.tool_args,
            status=p.status.value,
            executed_result=p.executed_result,
            created_at=p.created_at,
            updated_at=p.updated_at,
        )
        for p in result.pending_actions
    ]


@router.post("/ai/pending-actions/{action_id}/approve", response_model=AiPendingActionResponse)
async def approve_pending_action(
    action_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:update"),
    mediator: Mediator = Depends(get_mediator),
) -> AiPendingActionResponse:
    dto = await mediator.send(
        ExecutePendingAction(
            tenant_id=org.tenant_id,
            user_id=user.id,
            action_id=action_id,
            approve=True,
        )
    )
    return AiPendingActionResponse(
        id=dto.id,
        conversation_id=dto.conversation_id,
        message_id=dto.message_id,
        tool_name=dto.tool_name,
        tool_args=dto.tool_args,
        status=dto.status.value,
        executed_result=dto.executed_result,
        created_at=dto.created_at,
        updated_at=dto.updated_at,
    )


@router.post("/ai/pending-actions/{action_id}/reject", response_model=AiPendingActionResponse)
async def reject_pending_action(
    action_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:update"),
    mediator: Mediator = Depends(get_mediator),
) -> AiPendingActionResponse:
    dto = await mediator.send(
        ExecutePendingAction(
            tenant_id=org.tenant_id,
            user_id=user.id,
            action_id=action_id,
            approve=False,
        )
    )
    return AiPendingActionResponse(
        id=dto.id,
        conversation_id=dto.conversation_id,
        message_id=dto.message_id,
        tool_name=dto.tool_name,
        tool_args=dto.tool_args,
        status=dto.status.value,
        executed_result=dto.executed_result,
        created_at=dto.created_at,
        updated_at=dto.updated_at,
    )


async def _run_turn(
    mediator: Mediator,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    project_id: uuid.UUID | None,
    content: str,
    autonomy_level: str,
    conversation_id: uuid.UUID | None,
    provider_config_id: uuid.UUID | None,
    artifact_context_id: uuid.UUID | None,
) -> AgentTurnResponse:
    if not settings.enable_ai_features:
        raise PolicyDeniedError("AI features are disabled")
    _policy.validate_user_content(content)
    _policy.can_use_autonomy(AutonomyLevel(autonomy_level))
    dto = await mediator.send(
        RunAgentTurn(
            tenant_id=tenant_id,
            user_id=user_id,
            project_id=project_id,
            content=content,
            autonomy_level=AutonomyLevel(autonomy_level),
            conversation_id=conversation_id,
            provider_config_id=provider_config_id,
            artifact_context_id=artifact_context_id,
        )
    )
    return AgentTurnResponse(
        conversation=AiConversationResponse(
            id=dto.conversation.id,
            project_id=dto.conversation.project_id,
            provider_config_id=dto.conversation.provider_config_id,
            autonomy_level=dto.conversation.autonomy_level.value,
            title=dto.conversation.title,
            artifact_context_id=dto.conversation.artifact_context_id,
            created_at=dto.conversation.created_at,
            updated_at=dto.conversation.updated_at,
        ),
        assistant_message=AiMessageResponse(
            id=dto.assistant_message.id,
            conversation_id=dto.assistant_message.conversation_id,
            role=dto.assistant_message.role.value,
            content=dto.assistant_message.content,
            tool_calls=dto.assistant_message.tool_calls,
            tool_results=dto.assistant_message.tool_results,
            created_at=dto.assistant_message.created_at,
        ),
        pending_actions=[
            AiPendingActionResponse(
                id=p.id,
                conversation_id=p.conversation_id,
                message_id=p.message_id,
                tool_name=p.tool_name,
                tool_args=p.tool_args,
                status=p.status.value,
                executed_result=p.executed_result,
                created_at=p.created_at,
                updated_at=p.updated_at,
            )
            for p in dto.pending_actions
        ],
    )

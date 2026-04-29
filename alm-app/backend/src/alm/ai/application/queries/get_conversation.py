"""Get conversation + messages + pending actions."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.ai.application.dtos import AiConversationDTO, AiMessageDTO, AiPendingActionDTO
from alm.ai.domain.ports import IAiRepository
from alm.shared.application.query import Query, QueryHandler


@dataclass
class GetConversationResult:
    conversation: AiConversationDTO
    messages: list[AiMessageDTO]
    pending_actions: list[AiPendingActionDTO]


@dataclass(frozen=True)
class GetConversation(Query):
    tenant_id: uuid.UUID
    conversation_id: uuid.UUID


class GetConversationHandler(QueryHandler[GetConversationResult | None]):
    def __init__(self, repo: IAiRepository) -> None:
        self._repo = repo

    async def handle(self, query: Query) -> GetConversationResult | None:
        assert isinstance(query, GetConversation)
        c = await self._repo.get_conversation(query.conversation_id)
        if c is None or c.tenant_id != query.tenant_id:
            return None
        messages = await self._repo.list_messages(c.id)
        pending = await self._repo.list_pending_actions(c.id)
        return GetConversationResult(
            conversation=AiConversationDTO(
                id=c.id,
                tenant_id=c.tenant_id,
                project_id=c.project_id,
                user_id=c.user_id,
                provider_config_id=c.provider_config_id,
                autonomy_level=c.autonomy_level,
                title=c.title,
                artifact_context_id=c.artifact_context_id,
                created_at=c.created_at,
                updated_at=c.updated_at,
            ),
            messages=[
                AiMessageDTO(
                    id=m.id,
                    conversation_id=m.conversation_id,
                    role=m.role,
                    content=m.content,
                    tool_calls=m.tool_calls,
                    tool_results=m.tool_results,
                    created_at=m.created_at,
                )
                for m in messages
            ],
            pending_actions=[
                AiPendingActionDTO(
                    id=p.id,
                    conversation_id=p.conversation_id,
                    message_id=p.message_id,
                    tool_name=p.tool_name,
                    tool_args=p.tool_args,
                    status=p.status,
                    executed_result=p.executed_result,
                    created_at=p.created_at,
                    updated_at=p.updated_at,
                )
                for p in pending
            ],
        )

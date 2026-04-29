"""List conversations for current user."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.ai.application.dtos import AiConversationDTO
from alm.ai.domain.ports import IAiRepository
from alm.shared.application.query import Query, QueryHandler


@dataclass(frozen=True)
class ListConversations(Query):
    tenant_id: uuid.UUID
    user_id: uuid.UUID
    project_id: uuid.UUID | None = None


class ListConversationsHandler(QueryHandler[list[AiConversationDTO]]):
    def __init__(self, repo: IAiRepository) -> None:
        self._repo = repo

    async def handle(self, query: Query) -> list[AiConversationDTO]:
        assert isinstance(query, ListConversations)
        conversations = await self._repo.list_conversations(
            tenant_id=query.tenant_id,
            user_id=query.user_id,
            project_id=query.project_id,
        )
        return [
            AiConversationDTO(
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
            )
            for c in conversations
        ]

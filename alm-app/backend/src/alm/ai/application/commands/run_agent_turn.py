"""Run a multi-turn AI assistant loop for a conversation."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.ai.application.agent.react_loop import ReActLoop
from alm.ai.application.agent.tool_executor import ToolExecutor
from alm.ai.application.observability import track_ai_request
from alm.ai.application.policy import AiPolicyEvaluator
from alm.ai.application.sanitization import redact_pii
from alm.ai.application.dtos import (
    AgentContext,
    AgentTurnResultDTO,
    AiConversationDTO,
    AiMessageDTO,
    AiPendingActionDTO,
)
from alm.ai.domain.entities import AiConversation, AiMessage
from alm.ai.domain.entities import AiPendingAction
from alm.ai.domain.ports import IAiRepository
from alm.ai.domain.value_objects import AutonomyLevel, MessageRole
from alm.ai.infrastructure.providers.router import ProviderRouter
from alm.config.settings import settings
from alm.shared.application.command import Command, CommandHandler
from alm.shared.application.mediator import Mediator
from alm.shared.domain.exceptions import ValidationError


@dataclass(frozen=True)
class RunAgentTurn(Command):
    tenant_id: uuid.UUID
    user_id: uuid.UUID
    project_id: uuid.UUID | None
    content: str
    autonomy_level: AutonomyLevel
    conversation_id: uuid.UUID | None = None
    provider_config_id: uuid.UUID | None = None
    artifact_context_id: uuid.UUID | None = None


class RunAgentTurnHandler(CommandHandler[AgentTurnResultDTO]):
    def __init__(self, repo: IAiRepository, mediator: Mediator) -> None:
        self._repo = repo
        self._mediator = mediator
        self._policy = AiPolicyEvaluator()

    async def handle(self, command: Command) -> AgentTurnResultDTO:
        assert isinstance(command, RunAgentTurn)
        self._policy.validate_user_content(command.content)
        self._policy.can_use_autonomy(command.autonomy_level)

        conversation = await self._ensure_conversation(command)
        user_msg = AiMessage.create(
            conversation_id=conversation.id,
            role=MessageRole.USER,
            content=redact_pii(command.content.strip()),
        )
        await self._repo.save_message(user_msg)

        history = await self._repo.list_messages(conversation.id)
        chat_messages = [
            {
                "role": m.role.value,
                "content": m.content,
                **({"tool_calls": m.tool_calls} if m.tool_calls else {}),
                **({"tool_results": m.tool_results} if m.tool_results else {}),
            }
            for m in history
        ]

        context = AgentContext(
            tenant_id=conversation.tenant_id,
            project_id=conversation.project_id,
            user_id=conversation.user_id,
            conversation_id=conversation.id,
        )
        provider_router = ProviderRouter(self._repo, conversation.tenant_id)
        primary, provider_name, _fallbacks = await provider_router.get_primary_and_fallbacks(
            conversation.provider_config_id
        )
        loop = ReActLoop(
            llm=primary,
            tool_executor=ToolExecutor(self._mediator, context),
            repo=self._repo,
            autonomy_level=conversation.autonomy_level,
            policy=self._policy,
            max_turns=settings.ai_max_conversation_turns,
        )
        with track_ai_request("run_agent_turn", provider_name):
            result = await loop.run(conversation.id, chat_messages, context)

        return AgentTurnResultDTO(
            conversation=_conv_dto(conversation),
            assistant_message=_msg_dto(result.assistant_message),
            pending_actions=[_pending_dto(p) for p in result.pending_actions],
        )

    async def _ensure_conversation(self, command: RunAgentTurn) -> AiConversation:
        if command.conversation_id is not None:
            existing = await self._repo.get_conversation(command.conversation_id)
            if existing is None:
                raise ValidationError("Conversation not found")
            return existing

        provider = await (
            self._repo.get_provider_config(command.provider_config_id)
            if command.provider_config_id is not None
            else self._repo.get_default_provider_config(command.tenant_id)
        )
        if provider is None:
            raise ValidationError("No default provider configured")

        conversation = AiConversation.create(
            tenant_id=command.tenant_id,
            user_id=command.user_id,
            project_id=command.project_id,
            provider_config_id=provider.id,
            autonomy_level=command.autonomy_level,
            title=(command.content[:120] or "AI conversation").strip(),
            artifact_context_id=command.artifact_context_id,
        )
        return await self._repo.save_conversation(conversation)


def _conv_dto(c: AiConversation) -> AiConversationDTO:
    return AiConversationDTO(
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


def _msg_dto(m: AiMessage) -> AiMessageDTO:
    return AiMessageDTO(
        id=m.id,
        conversation_id=m.conversation_id,
        role=m.role,
        content=m.content,
        tool_calls=m.tool_calls,
        tool_results=m.tool_results,
        created_at=m.created_at,
    )


def _pending_dto(p: AiPendingAction) -> AiPendingActionDTO:
    return AiPendingActionDTO(
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

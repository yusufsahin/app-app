"""Approve/reject and execute pending AI actions."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.ai.application.agent.tool_executor import ToolExecutor
from alm.ai.application.dtos import AgentContext, AiPendingActionDTO
from alm.ai.domain.entities import AiPendingAction
from alm.ai.domain.ports import IAiRepository
from alm.ai.domain.value_objects import PendingActionStatus
from alm.shared.application.command import Command, CommandHandler
from alm.shared.application.mediator import Mediator
from alm.shared.domain.exceptions import ValidationError


@dataclass(frozen=True)
class ExecutePendingAction(Command):
    tenant_id: uuid.UUID
    user_id: uuid.UUID
    action_id: uuid.UUID
    approve: bool


class ExecutePendingActionHandler(CommandHandler[AiPendingActionDTO]):
    def __init__(self, repo: IAiRepository, mediator: Mediator) -> None:
        self._repo = repo
        self._mediator = mediator

    async def handle(self, command: Command) -> AiPendingActionDTO:
        assert isinstance(command, ExecutePendingAction)
        action = await self._repo.get_pending_action(command.action_id)
        if action is None:
            raise ValidationError("Pending action not found")
        if action.status != PendingActionStatus.PENDING:
            return _to_dto(action)
        if not command.approve:
            action.status = PendingActionStatus.REJECTED
            saved = await self._repo.save_pending_action(action)
            return _to_dto(saved)

        conv = await self._repo.get_conversation(action.conversation_id)
        if conv is None:
            raise ValidationError("Conversation not found")
        executor = ToolExecutor(
            mediator=self._mediator,
            context=AgentContext(
                tenant_id=conv.tenant_id,
                project_id=conv.project_id,
                user_id=command.user_id,
                conversation_id=conv.id,
            ),
        )
        result = await executor.execute(action.tool_name, action.tool_args)
        action.status = PendingActionStatus.EXECUTED
        action.executed_result = result
        saved = await self._repo.save_pending_action(action)
        return _to_dto(saved)


def _to_dto(action: AiPendingAction) -> AiPendingActionDTO:
    return AiPendingActionDTO(
        id=action.id,
        conversation_id=action.conversation_id,
        message_id=action.message_id,
        tool_name=action.tool_name,
        tool_args=action.tool_args,
        status=action.status,
        executed_result=action.executed_result,
        created_at=action.created_at,
        updated_at=action.updated_at,
    )

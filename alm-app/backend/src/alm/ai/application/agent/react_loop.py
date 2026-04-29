"""ReAct loop for ALM chat agent."""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from typing import Any

from alm.ai.application.agent.alm_tools import ALM_TOOLS
from alm.ai.application.agent.tool_executor import ToolExecutor
from alm.ai.application.dtos import AgentContext
from alm.ai.application.observability import AI_TOOL_CALLS_TOTAL
from alm.ai.application.policy import AiPolicyEvaluator
from alm.ai.domain.entities import AiMessage, AiPendingAction
from alm.ai.domain.ports import IAiRepository, ILlmProvider
from alm.ai.domain.value_objects import AutonomyLevel, MessageRole


@dataclass
class AgentRunOutput:
    assistant_message: AiMessage
    pending_actions: list[AiPendingAction]
    tool_results: list[dict[str, Any]]


class ReActLoop:
    def __init__(
        self,
        llm: ILlmProvider,
        tool_executor: ToolExecutor,
        repo: IAiRepository,
        autonomy_level: AutonomyLevel,
        policy: AiPolicyEvaluator | None = None,
        max_turns: int = 10,
    ) -> None:
        self._llm = llm
        self._tool_executor = tool_executor
        self._repo = repo
        self._autonomy_level = autonomy_level
        self._policy = policy or AiPolicyEvaluator()
        self._max_turns = max_turns

    async def run(
        self,
        conversation_id: uuid.UUID,
        messages: list[dict[str, Any]],
        context: AgentContext,
    ) -> AgentRunOutput:
        pending_actions: list[AiPendingAction] = []
        tool_results: list[dict[str, Any]] = []
        last_assistant = AiMessage.create(
            conversation_id=conversation_id,
            role=MessageRole.ASSISTANT,
            content="",
        )

        for _ in range(self._max_turns):
            response = await self._llm.complete(
                messages=messages,
                tools=ALM_TOOLS if self._autonomy_level != AutonomyLevel.SUGGEST else None,
            )
            assistant = response.choices[0].message
            content = getattr(assistant, "content", None)
            raw_tool_calls = getattr(assistant, "tool_calls", None)
            tool_calls = [tc.model_dump() for tc in raw_tool_calls] if raw_tool_calls else None

            last_assistant = AiMessage.create(
                conversation_id=conversation_id,
                role=MessageRole.ASSISTANT,
                content=content,
                tool_calls=tool_calls,
            )
            await self._repo.save_message(last_assistant)
            messages.append(_to_chat_message(last_assistant))

            if not raw_tool_calls:
                break

            if self._autonomy_level == AutonomyLevel.SUGGEST:
                break

            for tc in raw_tool_calls:
                args = json.loads(tc.function.arguments or "{}")
                decision = self._policy.check_tool_call(tc.function.name, args, self._autonomy_level)
                if not decision.allowed:
                    AI_TOOL_CALLS_TOTAL.labels(tool_name=tc.function.name, status="denied").inc()
                    continue
                if self._autonomy_level == AutonomyLevel.CONFIRM:
                    pending = AiPendingAction.create(
                        conversation_id=conversation_id,
                        message_id=last_assistant.id,
                        tool_name=tc.function.name,
                        tool_args=args,
                    )
                    pending_actions.append(await self._repo.save_pending_action(pending))
                    AI_TOOL_CALLS_TOTAL.labels(tool_name=tc.function.name, status="pending").inc()
                else:
                    result = await self._tool_executor.execute(tc.function.name, args)
                    tool_results.append({"tool_name": tc.function.name, "result": result})
                    tool_msg = {
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": json.dumps(result),
                    }
                    messages.append(tool_msg)
                    await self._repo.save_message(
                        AiMessage.create(
                            conversation_id=conversation_id,
                            role=MessageRole.TOOL,
                            content=tool_msg["content"],
                            tool_results=[{"tool_name": tc.function.name, "result": result}],
                        )
                    )
                    AI_TOOL_CALLS_TOTAL.labels(tool_name=tc.function.name, status="executed").inc()

            if self._autonomy_level == AutonomyLevel.CONFIRM:
                break

        return AgentRunOutput(
            assistant_message=last_assistant,
            pending_actions=pending_actions,
            tool_results=tool_results,
        )


def _to_chat_message(msg: AiMessage) -> dict[str, Any]:
    payload: dict[str, Any] = {"role": msg.role.value, "content": msg.content}
    if msg.tool_calls:
        payload["tool_calls"] = msg.tool_calls
    if msg.tool_results:
        payload["tool_results"] = msg.tool_results
    return payload

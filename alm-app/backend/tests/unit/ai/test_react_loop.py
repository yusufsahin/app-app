from __future__ import annotations

import uuid
from dataclasses import dataclass
from types import SimpleNamespace
from typing import Any

import pytest

from alm.ai.application.agent.react_loop import ReActLoop
from alm.ai.application.dtos import AgentContext
from alm.ai.domain.entities import AiMessage, AiPendingAction
from alm.ai.domain.ports import IAiRepository, ILlmProvider
from alm.ai.domain.value_objects import AutonomyLevel


@dataclass
class _InMemoryRepo(IAiRepository):
    saved_messages: list[AiMessage]
    saved_actions: list[AiPendingAction]

    async def get_provider_config(self, config_id): return None
    async def get_default_provider_config(self, tenant_id): return None
    async def list_provider_configs(self, tenant_id): return []
    async def save_provider_config(self, config): return config
    async def delete_provider_config(self, config_id): return None
    async def get_conversation(self, conversation_id): return None
    async def list_conversations(self, tenant_id, user_id, project_id=None): return []
    async def save_conversation(self, conversation): return conversation
    async def list_messages(self, conversation_id): return []
    async def save_message(self, message):
        self.saved_messages.append(message)
        return message
    async def list_pending_actions(self, conversation_id, status=None): return []
    async def get_pending_action(self, action_id): return None
    async def save_pending_action(self, action):
        self.saved_actions.append(action)
        return action
    async def list_insights(self, tenant_id, project_id, include_dismissed=False): return []
    async def save_insight(self, insight): return insight
    async def dismiss_insight(self, insight_id): return None


class _DummyLlm(ILlmProvider):
    async def complete(self, messages: list[dict[str, Any]], tools=None, stream=False):
        _ = messages, tools, stream
        return SimpleNamespace(
            choices=[
                SimpleNamespace(
                    message=SimpleNamespace(
                        content="I can help with that.",
                        tool_calls=None,
                    )
                )
            ]
        )

    async def stream(self, messages: list[dict[str, Any]], tools=None):
        _ = messages, tools
        yield {}


class _NoopToolExecutor:
    async def execute(self, tool_name: str, args: dict[str, Any]) -> dict[str, Any]:
        _ = tool_name, args
        return {}


@pytest.mark.asyncio
async def test_react_loop_suggest_mode_returns_text_without_actions() -> None:
    repo = _InMemoryRepo(saved_messages=[], saved_actions=[])
    loop = ReActLoop(
        llm=_DummyLlm(),
        tool_executor=_NoopToolExecutor(),  # type: ignore[arg-type]
        repo=repo,
        autonomy_level=AutonomyLevel.SUGGEST,
        max_turns=1,
    )
    conversation_id = uuid.uuid4()
    result = await loop.run(
        conversation_id=conversation_id,
        messages=[{"role": "user", "content": "hello"}],
        context=AgentContext(
            tenant_id=uuid.uuid4(),
            project_id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            conversation_id=conversation_id,
        ),
    )

    assert result.assistant_message.content == "I can help with that."
    assert result.pending_actions == []
    assert result.tool_results == []
    assert len(repo.saved_messages) == 1
    assert repo.saved_actions == []

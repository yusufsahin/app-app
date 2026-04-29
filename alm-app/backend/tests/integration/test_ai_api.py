from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from httpx import AsyncClient


async def _register_and_get_org(client: AsyncClient) -> tuple[str, dict[str, str]]:
    email = f"ai-int-{uuid.uuid4().hex[:10]}@example.com"
    register = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "SecurePass123",
            "display_name": "AI Admin",
            "org_name": f"AI Org {uuid.uuid4().hex[:6]}",
        },
    )
    register.raise_for_status()
    token = register.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    tenants = await client.get("/api/v1/tenants/", headers=headers)
    tenants.raise_for_status()
    org_slug = tenants.json()[0]["slug"]
    return org_slug, headers


class _TextOnlyLlm:
    async def complete(self, messages, tools=None, stream=False):
        _ = messages, tools, stream
        return SimpleNamespace(
            choices=[
                SimpleNamespace(
                    message=SimpleNamespace(
                        content='{"description":"Draft","acceptance_criteria":["AC1"],"test_cases":["TC1"]}',
                        tool_calls=None,
                    )
                )
            ]
        )


class _ToolCallLlm:
    async def complete(self, messages, tools=None, stream=False):
        _ = messages, tools, stream
        tool_call = SimpleNamespace(
            id="tc-1",
            function=SimpleNamespace(name="list_artifacts", arguments="{}"),
            model_dump=lambda: {
                "id": "tc-1",
                "function": {"name": "list_artifacts", "arguments": "{}"},
                "type": "function",
            },
        )
        return SimpleNamespace(
            choices=[
                SimpleNamespace(
                    message=SimpleNamespace(
                        content="I can do that.",
                        tool_calls=[tool_call],
                    )
                )
            ]
        )


@pytest.mark.asyncio
async def test_ai_generate_provider_and_conversation_flow(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    org_slug, headers = await _register_and_get_org(client)
    monkeypatch.setattr("alm.config.settings.settings.enable_ai_features", True)

    create_provider = await client.post(
        f"/api/v1/orgs/{org_slug}/ai/providers",
        headers=headers,
        json={
            "name": "test-openai",
            "provider": "openai",
            "model": "gpt-4o-mini",
            "api_key": "test-key",
            "is_default": True,
            "is_enabled": True,
        },
    )
    assert create_provider.status_code == 201
    provider_id = create_provider.json()["id"]

    with patch("alm.ai.application.commands.generate_artifact_content.build_provider", return_value=_TextOnlyLlm()):
        generate = await client.post(
            f"/api/v1/orgs/{org_slug}/ai/generate",
            headers=headers,
            json={
                "project_id": str(uuid.uuid4()),
                "artifact_type": "defect",
                "title": "Login issue",
                "provider_config_id": provider_id,
            },
        )
    assert generate.status_code == 200
    payload = generate.json()
    assert payload["description"] == "Draft"
    assert payload["acceptance_criteria"] == ["AC1"]

    with patch("alm.ai.application.commands.run_agent_turn.build_provider", return_value=_TextOnlyLlm()):
        chat = await client.post(
            f"/api/v1/orgs/{org_slug}/ai/conversations",
            headers=headers,
            json={
                "first_message": "Summarize backlog",
                "autonomy_level": "suggest",
                "provider_config_id": provider_id,
            },
        )
    assert chat.status_code == 200
    chat_json = chat.json()
    assert chat_json["assistant_message"]["content"] is not None
    assert isinstance(chat_json["conversation"]["id"], str)


@pytest.mark.asyncio
async def test_ai_confirm_mode_creates_and_rejects_pending_action(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    org_slug, headers = await _register_and_get_org(client)
    monkeypatch.setattr("alm.config.settings.settings.enable_ai_features", True)

    create_provider = await client.post(
        f"/api/v1/orgs/{org_slug}/ai/providers",
        headers=headers,
        json={
            "name": "test-openai",
            "provider": "openai",
            "model": "gpt-4o-mini",
            "api_key": "test-key",
            "is_default": True,
            "is_enabled": True,
        },
    )
    assert create_provider.status_code == 201
    provider_id = create_provider.json()["id"]

    with patch("alm.ai.application.commands.run_agent_turn.build_provider", return_value=_ToolCallLlm()):
        chat = await client.post(
            f"/api/v1/orgs/{org_slug}/ai/conversations",
            headers=headers,
            json={
                "first_message": "List current artifacts",
                "autonomy_level": "confirm",
                "provider_config_id": provider_id,
            },
        )
    assert chat.status_code == 200
    chat_json = chat.json()
    assert len(chat_json["pending_actions"]) == 1
    action_id = chat_json["pending_actions"][0]["id"]
    assert chat_json["pending_actions"][0]["status"] == "pending"

    reject = await client.post(
        f"/api/v1/orgs/{org_slug}/ai/pending-actions/{action_id}/reject",
        headers=headers,
    )
    assert reject.status_code == 200
    assert reject.json()["status"] == "rejected"

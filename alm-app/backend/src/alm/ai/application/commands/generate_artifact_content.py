"""Single-shot artifact content generation command."""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass

from alm.ai.application.observability import track_ai_request
from alm.ai.application.policy import AiPolicyEvaluator
from alm.ai.application.sanitization import redact_pii
from alm.ai.application.dtos import GeneratedArtifactContentDTO
from alm.ai.domain.ports import IAiRepository
from alm.ai.infrastructure.providers.router import ProviderRouter
from alm.shared.application.command import Command, CommandHandler


@dataclass(frozen=True)
class GenerateArtifactContent(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    title: str
    artifact_type: str
    description_hint: str | None = None
    provider_config_id: uuid.UUID | None = None


class GenerateArtifactContentHandler(CommandHandler[GeneratedArtifactContentDTO]):
    def __init__(self, repo: IAiRepository) -> None:
        self._repo = repo
        self._policy = AiPolicyEvaluator()

    async def handle(self, command: Command) -> GeneratedArtifactContentDTO:
        assert isinstance(command, GenerateArtifactContent)
        prompt = _build_prompt(command)
        self._policy.validate_user_content(prompt)
        router = ProviderRouter(self._repo, command.tenant_id)
        with track_ai_request("generate_artifact_content", "fallback-router"):
            response, _provider_name = await router.complete_with_fallback(
                command.provider_config_id,
                messages=[{"role": "user", "content": redact_pii(prompt)}],
                tools=None,
                stream=False,
            )
        content = response.choices[0].message.content or ""
        parsed = _parse_json(content)
        return GeneratedArtifactContentDTO(
            description=parsed.get("description", ""),
            acceptance_criteria=_as_str_list(parsed.get("acceptance_criteria")),
            test_cases=_as_str_list(parsed.get("test_cases")),
        )


def _build_prompt(command: GenerateArtifactContent) -> str:
    return (
        "Generate ALM artifact draft as JSON with keys: description, acceptance_criteria, test_cases.\n"
        f"Artifact type: {command.artifact_type}\n"
        f"Title: {command.title}\n"
        f"Hint: {command.description_hint or ''}\n"
        "Return strict JSON only."
    )


def _parse_json(content: str) -> dict:
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return {"description": content, "acceptance_criteria": [], "test_cases": []}


def _as_str_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for item in value:
        if isinstance(item, str) and item.strip():
            out.append(item.strip())
    return out

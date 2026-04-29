"""Policy and safety guards for AI requests/actions."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from alm.ai.domain.value_objects import AutonomyLevel
from alm.config.settings import settings
from alm.shared.domain.exceptions import PolicyDeniedError, ValidationError


@dataclass(frozen=True)
class ToolPolicyDecision:
    allowed: bool
    reason: str | None = None


class AiPolicyEvaluator:
    """Centralized AI policy checks used by commands/routes."""

    def validate_user_content(self, content: str) -> None:
        trimmed = content.strip()
        if not trimmed:
            raise ValidationError("Message content is required")
        if len(trimmed) > settings.ai_max_prompt_chars:
            raise ValidationError(f"Message too long (max {settings.ai_max_prompt_chars} characters)")

    def can_use_autonomy(self, autonomy: AutonomyLevel) -> None:
        if autonomy == AutonomyLevel.AUTO and not settings.ai_enable_auto_mode:
            raise PolicyDeniedError("Auto mode is disabled by policy")

    def check_tool_call(self, tool_name: str, args: dict[str, Any], autonomy: AutonomyLevel) -> ToolPolicyDecision:
        _ = args
        if autonomy == AutonomyLevel.SUGGEST:
            return ToolPolicyDecision(allowed=False, reason="Suggest mode cannot execute tools")
        if tool_name in settings.ai_blocked_tools:
            return ToolPolicyDecision(allowed=False, reason=f"Tool '{tool_name}' is blocked by policy")
        return ToolPolicyDecision(allowed=True)

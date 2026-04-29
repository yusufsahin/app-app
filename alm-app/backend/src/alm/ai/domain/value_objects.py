"""AI domain value objects."""

from __future__ import annotations

from enum import StrEnum


class AutonomyLevel(StrEnum):
    SUGGEST = "suggest"   # AI only suggests content — no write actions
    CONFIRM = "confirm"   # AI queues actions, user approves before execution
    AUTO = "auto"         # AI executes actions directly (fully autonomous)


class MessageRole(StrEnum):
    USER = "user"
    ASSISTANT = "assistant"
    TOOL = "tool"


class PendingActionStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXECUTED = "executed"


class InsightSeverity(StrEnum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class InsightType(StrEnum):
    STALE_ARTIFACT = "stale_artifact"
    COVERAGE_GAP = "coverage_gap"
    DUPLICATE = "duplicate"
    ORPHAN = "orphan"
    CUSTOM = "custom"

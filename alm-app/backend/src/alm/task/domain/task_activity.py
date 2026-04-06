"""Allowed task activity values (ADO Scrum–style)."""

from __future__ import annotations

from alm.shared.domain.exceptions import ValidationError

TASK_ACTIVITIES: tuple[str, ...] = (
    "Development",
    "Testing",
    "Design",
    "Documentation",
)

_TASK_ACTIVITY_SET = frozenset(TASK_ACTIVITIES)


def normalize_activity(raw: str | None) -> str | None:
    """Return None for empty/whitespace; otherwise strip."""
    if raw is None:
        return None
    s = raw.strip()
    return s if s else None


def parse_activity(raw: str | None) -> str | None:
    """Normalize activity; raise if non-empty value is not in the allow-list."""
    v = normalize_activity(raw)
    if v is None:
        return None
    if v not in _TASK_ACTIVITY_SET:
        raise ValidationError(f"Invalid task activity '{v}'")
    return v


def parse_non_negative_hours(name: str, value: float | None) -> float | None:
    """Return value or None; raise if value is negative."""
    if value is None:
        return None
    if value < 0:
        raise ValidationError(f"{name} must be non-negative")
    return value


def task_activity_options() -> list[dict[str, str]]:
    """Form schema choice options: id and label match ADO-style names."""
    return [{"id": a, "label": a} for a in TASK_ACTIVITIES]

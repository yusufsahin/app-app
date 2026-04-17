"""Report catalog metadata (extensible via new registrations in builtin.py)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

ReportScope = Literal["org", "project"]


@dataclass(frozen=True)
class ReportSpec:
    """Stable id and UX copy; parameters are described by the paired Pydantic model."""

    id: str
    title: str
    description: str
    category: str
    scope: ReportScope

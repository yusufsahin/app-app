from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ReportRunRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    report_id: str = Field(min_length=1, max_length=256)
    parameters: dict[str, Any] = Field(default_factory=dict)
    row_limit: int = Field(default=5000, ge=1, le=50_000)


class ReportRunResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    report_id: str
    parameters: dict[str, Any]
    data: dict[str, Any]
    row_limit: int

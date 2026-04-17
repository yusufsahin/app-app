from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any

from alm.shared.application.query import Query


@dataclass(frozen=True)
class ListReportDefinitions(Query):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    user_id: uuid.UUID


@dataclass(frozen=True)
class GetReportDefinition(Query):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    user_id: uuid.UUID
    report_id: uuid.UUID


@dataclass(frozen=True)
class ExecuteStoredReport(Query):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    user_id: uuid.UUID
    report_id: uuid.UUID
    mediator: Any  # Mediator
    allow_draft: bool = True
    row_limit: int = 5000

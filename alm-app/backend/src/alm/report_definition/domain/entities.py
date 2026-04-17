from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any


@dataclass
class ReportDefinition:
    id: uuid.UUID
    tenant_id: uuid.UUID
    project_id: uuid.UUID | None
    created_by_id: uuid.UUID | None
    forked_from_id: uuid.UUID | None
    catalog_key: str | None
    name: str
    description: str
    visibility: str
    query_kind: str
    builtin_report_id: str | None
    builtin_parameters: dict[str, Any]
    sql_text: str | None
    sql_bind_overrides: dict[str, Any]
    chart_spec: dict[str, Any]
    lifecycle_status: str
    last_validated_at: datetime | None
    last_validation_ok: bool
    last_validation_message: str | None
    published_at: datetime | None
    created_at: datetime | None
    updated_at: datetime | None

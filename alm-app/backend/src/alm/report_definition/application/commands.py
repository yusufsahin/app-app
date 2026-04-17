from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any

from alm.shared.application.command import Command


@dataclass(frozen=True)
class CreateReportDefinition(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    user_id: uuid.UUID
    name: str
    description: str = ""
    visibility: str = "private"
    query_kind: str = "sql"
    builtin_report_id: str | None = None
    builtin_parameters: dict[str, Any] | None = None
    sql_text: str | None = None
    sql_bind_overrides: dict[str, Any] | None = None
    chart_spec: dict[str, Any] | None = None
    catalog_key: str | None = None


@dataclass(frozen=True)
class UpdateReportDefinition(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    user_id: uuid.UUID
    report_id: uuid.UUID
    name: str | None = None
    description: str | None = None
    visibility: str | None = None
    builtin_parameters: dict[str, Any] | None = None
    sql_text: str | None = None
    sql_bind_overrides: dict[str, Any] | None = None
    chart_spec: dict[str, Any] | None = None


@dataclass(frozen=True)
class DeleteReportDefinition(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    user_id: uuid.UUID
    report_id: uuid.UUID


@dataclass(frozen=True)
class ForkReportDefinition(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    user_id: uuid.UUID
    source_report_id: uuid.UUID
    name: str | None = None


@dataclass(frozen=True)
class ForkReportFromCatalog(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    user_id: uuid.UUID
    catalog_key: str
    name: str | None = None


@dataclass(frozen=True)
class ValidateReportDefinition(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    user_id: uuid.UUID
    report_id: uuid.UUID
    mediator: Any  # Mediator — avoid circular import


@dataclass(frozen=True)
class PublishReportDefinition(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    user_id: uuid.UUID
    report_id: uuid.UUID

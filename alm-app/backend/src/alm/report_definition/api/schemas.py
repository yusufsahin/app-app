from __future__ import annotations

import uuid
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from alm.report_definition.application.dtos import ReportDefinitionDTO


class ReportDefinitionCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=255)
    description: str = ""
    visibility: str = Field(default="private", pattern="^(private|project)$")
    query_kind: str = Field(default="sql", pattern="^(builtin|sql)$")
    builtin_report_id: str | None = None
    builtin_parameters: dict[str, Any] = Field(default_factory=dict)
    sql_text: str | None = None
    sql_bind_overrides: dict[str, Any] = Field(default_factory=dict)
    chart_spec: dict[str, Any] = Field(default_factory=dict)
    catalog_key: str | None = None


class ReportDefinitionUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    visibility: str | None = Field(default=None, pattern="^(private|project)$")
    builtin_parameters: dict[str, Any] | None = None
    sql_text: str | None = None
    sql_bind_overrides: dict[str, Any] | None = None
    chart_spec: dict[str, Any] | None = None


class ReportDefinitionForkRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, max_length=255)


class ReportDefinitionFromCatalogRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    catalog_key: str = Field(min_length=1, max_length=128)
    name: str | None = Field(default=None, max_length=255)


class ReportDefinitionResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

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
    last_validated_at: str | None
    last_validation_ok: bool
    last_validation_message: str | None
    published_at: str | None
    created_at: str | None
    updated_at: str | None


def report_definition_dto_to_response(d: ReportDefinitionDTO) -> ReportDefinitionResponse:
    return ReportDefinitionResponse(
        id=d.id,
        tenant_id=d.tenant_id,
        project_id=d.project_id,
        created_by_id=d.created_by_id,
        forked_from_id=d.forked_from_id,
        catalog_key=d.catalog_key,
        name=d.name,
        description=d.description,
        visibility=d.visibility,
        query_kind=d.query_kind,
        builtin_report_id=d.builtin_report_id,
        builtin_parameters=d.builtin_parameters,
        sql_text=d.sql_text,
        sql_bind_overrides=d.sql_bind_overrides,
        chart_spec=d.chart_spec,
        lifecycle_status=d.lifecycle_status,
        last_validated_at=d.last_validated_at,
        last_validation_ok=d.last_validation_ok,
        last_validation_message=d.last_validation_message,
        published_at=d.published_at,
        created_at=d.created_at,
        updated_at=d.updated_at,
    )


class ReportTemplateCatalogItemResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    catalog_key: str
    name: str
    description: str
    query_kind: str
    chart_spec: dict[str, Any]

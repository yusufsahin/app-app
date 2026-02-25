"""Form schema API response schemas."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class FormFieldSchemaResponse(BaseModel):
    key: str
    type: str
    label_key: str
    required: bool = False
    options: list[dict[str, Any]] | None = None
    default_value: Any = None
    order: int = 0
    visible_when: dict[str, Any] | None = None
    required_when: dict[str, Any] | None = None
    entity_ref: str | None = None
    allowed_parent_types: list[str] | None = None


class FormSchemaResponse(BaseModel):
    entity_type: str
    context: str
    fields: list[FormFieldSchemaResponse] = Field(default_factory=list)
    artifact_type_options: list[dict[str, str]] = Field(default_factory=list)


class ListColumnSchemaResponse(BaseModel):
    key: str
    label: str | None = None
    label_key: str | None = None
    type: str | None = None
    order: int = 0
    sortable: bool = True
    width: int | None = None


class ListFilterSchemaResponse(BaseModel):
    key: str
    label: str | None = None
    label_key: str | None = None
    type: str | None = None
    order: int = 0
    options: list[str] | None = None


class ListSchemaResponse(BaseModel):
    schema_version: str = "1.0"
    entity_type: str
    columns: list[ListColumnSchemaResponse] = Field(default_factory=list)
    filters: list[ListFilterSchemaResponse] = Field(default_factory=list)

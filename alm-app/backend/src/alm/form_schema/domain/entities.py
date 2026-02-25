"""Form schema domain entities."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class FormFieldSchema:
    """Schema for a single form field."""

    key: str
    type: str  # string, number, choice, entity_ref
    label_key: str
    required: bool = False
    options: list[dict[str, Any]] | None = None
    default_value: Any = None
    order: int = 0
    visible_when: dict[str, Any] | None = None
    required_when: dict[str, Any] | None = None
    entity_ref: str | None = None  # artifact, user
    allowed_parent_types: list[str] | None = None  # for parent_id entity_ref


@dataclass(frozen=True)
class FormSchema:
    """Schema for a metadata-driven form."""

    entity_type: str
    context: str
    fields: tuple[FormFieldSchema, ...]
    artifact_type_options: tuple[dict[str, str], ...] = ()  # [{id, label}, ...]


@dataclass(frozen=True)
class ListColumnSchema:
    """Column descriptor for metadata-driven list views."""

    key: str
    label: str | None = None
    label_key: str | None = None
    type: str | None = None
    order: int = 0
    sortable: bool = True
    width: int | None = None


@dataclass(frozen=True)
class ListFilterSchema:
    """Filter descriptor for metadata-driven list views."""

    key: str
    label: str | None = None
    label_key: str | None = None
    type: str | None = None
    order: int = 0
    options: list[str] | None = None


@dataclass(frozen=True)
class ListSchema:
    """List view schema (columns + filters)."""

    entity_type: str
    columns: tuple[ListColumnSchema, ...]
    filters: tuple[ListFilterSchema, ...] = ()

"""Audit domain core — JaVers-inspired object change tracking.

Concepts:
  GlobalId   — unique identity across entity types: "{EntityType}/{entity_id}"
  ChangeType — INITIAL (first persist), UPDATE, DELETE (soft-delete)
  AuditCommit — groups one or more snapshots in a single operation
  AuditSnapshot — full serialized state of an entity at a commit point
  PropertyChange — single field-level diff between two snapshots
  DiffEngine — computes property-level changes between snapshots
"""

from __future__ import annotations

import enum
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


class ChangeType(str, enum.Enum):
    INITIAL = "INITIAL"
    UPDATE = "UPDATE"
    DELETE = "DELETE"


@dataclass(frozen=True)
class GlobalId:
    entity_type: str
    entity_id: uuid.UUID

    @property
    def value(self) -> str:
        return f"{self.entity_type}/{self.entity_id}"

    @classmethod
    def parse(cls, raw: str) -> GlobalId:
        entity_type, entity_id_str = raw.split("/", 1)
        return cls(entity_type=entity_type, entity_id=uuid.UUID(entity_id_str))


@dataclass(frozen=True)
class PropertyChange:
    property_name: str
    left: Any = None
    right: Any = None


@dataclass(frozen=True)
class AuditCommit:
    id: uuid.UUID
    author_id: uuid.UUID | None
    tenant_id: uuid.UUID | None
    committed_at: datetime
    properties: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class AuditSnapshot:
    id: uuid.UUID
    commit_id: uuid.UUID
    global_id: str
    entity_type: str
    entity_id: uuid.UUID
    change_type: ChangeType
    state: dict[str, Any]
    changed_properties: list[str]
    version: int


class DiffEngine:
    """Computes property-level changes between two entity snapshots."""

    @staticmethod
    def diff(left: dict[str, Any] | None, right: dict[str, Any]) -> list[PropertyChange]:
        if left is None:
            return [PropertyChange(property_name=k, left=None, right=v) for k, v in right.items()]

        changes: list[PropertyChange] = []
        all_keys = set(left.keys()) | set(right.keys())
        for key in sorted(all_keys):
            old_val = left.get(key)
            new_val = right.get(key)
            if old_val != new_val:
                changes.append(PropertyChange(property_name=key, left=old_val, right=new_val))
        return changes

    @staticmethod
    def changed_property_names(left: dict[str, Any] | None, right: dict[str, Any]) -> list[str]:
        if left is None:
            return sorted(right.keys())
        return sorted(k for k in (set(left.keys()) | set(right.keys())) if left.get(k) != right.get(k))

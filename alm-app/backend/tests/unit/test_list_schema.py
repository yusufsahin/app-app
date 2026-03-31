"""Unit tests for list schema builder (artifact list columns + custom fields from manifest)."""

from __future__ import annotations

from alm.artifact.infrastructure.manifest_flattener import ManifestDefsFlattenerAdapter
from alm.form_schema.application.queries.get_list_schema import (
    _build_artifact_list_schema,
    _build_task_list_schema,
    _get_flat_manifest,
)
from tests.support.manifests import (
    LIST_SCHEMA_ARTIFACT_LIST_COLUMN_OVERRIDE,
    LIST_SCHEMA_ARTIFACT_LIST_TAGS_HIDDEN,
    LIST_SCHEMA_EMPTY_DEFS_MANIFEST,
    LIST_SCHEMA_FLAT_CUSTOM_COLUMNS,
    LIST_SCHEMA_FLAT_EMPTY_ARTIFACT_TYPES,
    LIST_SCHEMA_FLAT_REQUIREMENT_PRIORITY,
    LIST_SCHEMA_FROM_DEFS_MANIFEST,
    LIST_SCHEMA_TOP_LEVEL_MANIFEST,
)

_FLATTENER = ManifestDefsFlattenerAdapter()


def test_get_flat_manifest_from_defs():
    manifest = LIST_SCHEMA_FROM_DEFS_MANIFEST
    flat = _get_flat_manifest(manifest, _FLATTENER)
    assert len(flat["workflows"]) == 1
    assert flat["workflows"][0]["id"] == "basic"
    assert len(flat["artifact_types"]) == 1
    assert flat["artifact_types"][0]["id"] == "req"
    assert flat["artifact_types"][0].get("fields")


def test_get_flat_manifest_from_top_level():
    manifest = LIST_SCHEMA_TOP_LEVEL_MANIFEST
    flat = _get_flat_manifest(manifest, _FLATTENER)
    assert flat["workflows"] == manifest["workflows"]
    assert flat["artifact_types"] == manifest["artifact_types"]


def test_build_artifact_list_schema_includes_custom_columns():
    flat = LIST_SCHEMA_FLAT_CUSTOM_COLUMNS
    schema = _build_artifact_list_schema(flat, None)
    column_keys = [c.key for c in schema.columns]
    assert "artifact_key" in column_keys
    assert "title" in column_keys
    assert "state" in column_keys
    assert "tags" in column_keys
    assert "priority" in column_keys
    assert "effort" in column_keys
    assert "severity" in column_keys
    priority_col = next(c for c in schema.columns if c.key == "priority")
    assert priority_col.label == "Priority"
    assert priority_col.type == "string"
    effort_col = next(c for c in schema.columns if c.key == "effort")
    assert effort_col.label == "Effort"
    assert effort_col.type == "number"


def test_get_flat_manifest_empty_defs():
    """Empty defs yields empty workflows and artifact_types."""
    flat = _get_flat_manifest(LIST_SCHEMA_EMPTY_DEFS_MANIFEST, _FLATTENER)
    assert flat["workflows"] == []
    assert flat["artifact_types"] == []


def test_build_artifact_list_schema_empty_artifact_types():
    """Empty artifact_types still returns base columns (artifact_key, title, state)."""
    flat = LIST_SCHEMA_FLAT_EMPTY_ARTIFACT_TYPES
    schema = _build_artifact_list_schema(flat, None)
    column_keys = [c.key for c in schema.columns]
    assert "artifact_key" in column_keys
    assert "title" in column_keys
    assert "state" in column_keys
    assert "tags" in column_keys


def test_build_artifact_list_schema_tags_column_can_be_hidden():
    """Explicit tags column with visible:false suppresses auto-injected tags column."""
    flat = LIST_SCHEMA_FLAT_EMPTY_ARTIFACT_TYPES
    manifest = LIST_SCHEMA_ARTIFACT_LIST_TAGS_HIDDEN
    schema = _build_artifact_list_schema(flat, manifest)
    keys = [c.key for c in schema.columns]
    assert "tags" not in keys
    assert keys == ["title", "state"]


def test_build_artifact_list_schema_manifest_column_override():
    """artifact_list.columns in manifest controls visible core columns and order."""
    flat = LIST_SCHEMA_FLAT_REQUIREMENT_PRIORITY
    manifest = LIST_SCHEMA_ARTIFACT_LIST_COLUMN_OVERRIDE
    schema = _build_artifact_list_schema(flat, manifest)
    keys = [c.key for c in schema.columns]
    assert keys[:2] == ["title", "state"]
    assert "artifact_key" not in keys
    assert "tags" in keys
    assert "priority" in keys


def test_build_task_list_schema():
    """Task list schema returns fixed columns and state filter (P3)."""
    schema = _build_task_list_schema()
    assert schema.entity_type == "task"
    column_keys = [c.key for c in schema.columns]
    assert column_keys == ["id", "title", "state", "assignee_id", "rank_order", "created_at", "updated_at"]
    assert len(schema.filters) == 1
    assert schema.filters[0].key == "state"
    assert schema.filters[0].options == ["todo", "in_progress", "done"]

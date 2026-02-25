"""Unit tests for list schema builder (artifact list columns + custom fields from manifest)."""

from __future__ import annotations

from alm.artifact.infrastructure.manifest_flattener import ManifestDefsFlattenerAdapter
from alm.form_schema.application.queries.get_list_schema import (
    _build_artifact_list_schema,
    _build_task_list_schema,
    _get_flat_manifest,
)

_FLATTENER = ManifestDefsFlattenerAdapter()


def test_get_flat_manifest_from_defs():
    manifest = {
        "defs": [
            {"kind": "Workflow", "id": "basic", "states": ["new", "active"], "transitions": []},
            {
                "kind": "ArtifactType",
                "id": "req",
                "workflow_id": "basic",
                "fields": [{"id": "priority", "name": "Priority", "type": "string"}],
            },
        ],
    }
    flat = _get_flat_manifest(manifest, _FLATTENER)
    assert len(flat["workflows"]) == 1
    assert flat["workflows"][0]["id"] == "basic"
    assert len(flat["artifact_types"]) == 1
    assert flat["artifact_types"][0]["id"] == "req"
    assert flat["artifact_types"][0].get("fields")


def test_get_flat_manifest_from_top_level():
    manifest = {
        "workflows": [{"id": "basic", "states": ["new"], "transitions": []}],
        "artifact_types": [
            {
                "id": "requirement",
                "name": "Requirement",
                "workflow_id": "basic",
                "fields": [{"id": "effort", "name": "Effort", "type": "number"}],
            },
        ],
    }
    flat = _get_flat_manifest(manifest, _FLATTENER)
    assert flat["workflows"] == manifest["workflows"]
    assert flat["artifact_types"] == manifest["artifact_types"]


def test_build_artifact_list_schema_includes_custom_columns():
    flat = {
        "workflows": [{"id": "basic", "states": ["new", "active"], "transitions": []}],
        "artifact_types": [
            {
                "id": "requirement",
                "name": "Requirement",
                "workflow_id": "basic",
                "fields": [
                    {"id": "priority", "name": "Priority", "type": "string"},
                    {"id": "effort", "name": "Effort", "type": "number"},
                ],
            },
            {
                "id": "defect",
                "name": "Defect",
                "workflow_id": "basic",
                "fields": [
                    {"id": "priority", "name": "Priority", "type": "string"},
                    {"id": "severity", "name": "Severity", "type": "choice"},
                ],
            },
        ],
    }
    schema = _build_artifact_list_schema(flat)
    column_keys = [c.key for c in schema.columns]
    assert "artifact_key" in column_keys
    assert "title" in column_keys
    assert "state" in column_keys
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
    flat = _get_flat_manifest({"defs": []}, _FLATTENER)
    assert flat["workflows"] == []
    assert flat["artifact_types"] == []


def test_build_artifact_list_schema_empty_artifact_types():
    """Empty artifact_types still returns base columns (artifact_key, title, state)."""
    flat = {
        "workflows": [{"id": "basic", "states": ["new"], "transitions": []}],
        "artifact_types": [],
    }
    schema = _build_artifact_list_schema(flat)
    column_keys = [c.key for c in schema.columns]
    assert "artifact_key" in column_keys
    assert "title" in column_keys
    assert "state" in column_keys


def test_build_task_list_schema():
    """Task list schema returns fixed columns and state filter (P3)."""
    schema = _build_task_list_schema()
    assert schema.entity_type == "task"
    column_keys = [c.key for c in schema.columns]
    assert column_keys == ["id", "title", "state", "assignee_id", "rank_order", "created_at", "updated_at"]
    assert len(schema.filters) == 1
    assert schema.filters[0].key == "state"
    assert schema.filters[0].options == ["todo", "in_progress", "done"]

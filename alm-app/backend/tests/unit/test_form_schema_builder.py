"""Unit tests for FormSchema builder."""
from __future__ import annotations

import pytest

from alm.form_schema.application.builders.manifest_form_schema_builder import (
    build_artifact_create_form_schema,
    build_task_create_form_schema,
    build_form_schema,
)


SAMPLE_MANIFEST = {
    "defs": [
        {"kind": "Workflow", "id": "basic", "states": ["new", "active"], "transitions": [{"from": "new", "to": "active"}]},
        {
            "kind": "ArtifactType",
            "id": "epic",
            "workflow_id": "basic",
            "child_types": ["feature"],
            "fields": [{"id": "priority", "name": "Priority", "type": "string"}],
        },
        {
            "kind": "ArtifactType",
            "id": "feature",
            "workflow_id": "basic",
            "parent_types": ["epic"],
            "child_types": ["requirement"],
            "fields": [
                {"id": "story_points", "name": "Story Points", "type": "number", "requiredWhen": {"field": "typeName", "eq": "feature"}},
            ],
        },
        {
            "kind": "ArtifactType",
            "id": "defect",
            "workflow_id": "basic",
            "fields": [
                {
                    "id": "severity",
                    "name": "Severity",
                    "type": "choice",
                    "options": [{"id": "low", "label": "Low"}, {"id": "high", "label": "High"}],
                    "visibleWhen": {"field": "typeName", "in": ["defect"]},
                },
            ],
        },
    ],
}


class TestFormSchemaBuilder:
    def test_build_artifact_create_form_schema(self):
        schema = build_artifact_create_form_schema(SAMPLE_MANIFEST)
        assert schema.entity_type == "artifact"
        assert schema.context == "create"
        assert len(schema.artifact_type_options) == 3

        field_keys = [f.key for f in schema.fields]
        assert "artifact_type" in field_keys
        assert "parent_id" in field_keys
        assert "title" in field_keys
        assert "description" in field_keys
        assert "assignee_id" in field_keys
        assert "priority" in field_keys
        assert "story_points" in field_keys
        assert "severity" in field_keys

    def test_visible_when_normalized(self):
        schema = build_artifact_create_form_schema(SAMPLE_MANIFEST)
        severity_field = next(f for f in schema.fields if f.key == "severity")
        assert severity_field.visible_when is not None
        assert severity_field.visible_when["field"] == "artifact_type"
        assert severity_field.visible_when["in"] == ["defect"]
        assert severity_field.type == "choice"
        assert severity_field.options == [{"id": "low", "label": "Low"}, {"id": "high", "label": "High"}]

    def test_required_when_normalized(self):
        schema = build_artifact_create_form_schema(SAMPLE_MANIFEST)
        story_points_field = next(f for f in schema.fields if f.key == "story_points")
        assert story_points_field.required_when is not None
        assert story_points_field.required_when["field"] == "artifact_type"
        assert story_points_field.required_when["eq"] == "feature"

    def test_build_form_schema_artifact_create(self):
        schema = build_form_schema(SAMPLE_MANIFEST, "artifact", "create")
        assert schema is not None
        assert schema.entity_type == "artifact"

    def test_build_form_schema_unknown(self):
        assert build_form_schema(SAMPLE_MANIFEST, "unknown", "create") is None
        assert build_form_schema(SAMPLE_MANIFEST, "artifact", "edit") is None

    def test_build_task_create_form_schema(self):
        schema = build_task_create_form_schema()
        assert schema.entity_type == "task"
        assert schema.context == "create"
        assert schema.artifact_type_options == ()
        field_keys = [f.key for f in schema.fields]
        assert field_keys == ["title", "description", "state", "assignee_id", "rank_order"]
        state_field = next(f for f in schema.fields if f.key == "state")
        assert state_field.type == "choice"
        assert state_field.default_value == "todo"

    def test_build_form_schema_task_create_and_edit(self):
        assert build_form_schema({}, "task", "create") is not None
        assert build_form_schema({}, "task", "edit") is not None
        schema = build_form_schema({}, "task", "create")
        assert schema.entity_type == "task"
        assert schema.context == "create"

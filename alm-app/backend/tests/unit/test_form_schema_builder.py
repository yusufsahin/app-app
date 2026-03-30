"""Unit tests for FormSchema builder."""

from __future__ import annotations

from alm.artifact.infrastructure.manifest_flattener import ManifestDefsFlattenerAdapter
from alm.form_schema.application.builders.manifest_form_schema_builder import (
    build_artifact_create_form_schema,
    build_artifact_edit_form_schema,
    build_form_schema,
    build_task_create_form_schema,
)
from tests.support.manifests import (
    FORM_SCHEMA_BUILDER_MANIFEST as SAMPLE_MANIFEST,
    FORM_SCHEMA_TASK_WORKFLOW_MANIFEST,
)

_FLATTENER = ManifestDefsFlattenerAdapter()


class TestFormSchemaBuilder:
    def test_build_artifact_create_form_schema(self):
        schema = build_artifact_create_form_schema(SAMPLE_MANIFEST, _FLATTENER)
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
        assert "detected_by" in field_keys

    def test_custom_user_entity_ref_on_create_schema(self):
        schema = build_artifact_create_form_schema(SAMPLE_MANIFEST, _FLATTENER)
        detected = next(f for f in schema.fields if f.key == "detected_by")
        assert detected.type == "entity_ref"
        assert detected.entity_ref == "user"

    def test_create_schema_narrowed_by_artifact_type(self):
        schema = build_artifact_create_form_schema(SAMPLE_MANIFEST, _FLATTENER, artifact_type="feature")
        assert len(schema.artifact_type_options) == 1
        assert schema.artifact_type_options[0]["id"] == "feature"
        keys = [f.key for f in schema.fields]
        assert "story_points" in keys
        assert "severity" not in keys
        assert "priority" not in keys
        assert "detected_by" not in keys
        story = next(f for f in schema.fields if f.key == "story_points")
        assert story.required_when is None

    def test_create_schema_narrowed_defect(self):
        schema = build_artifact_create_form_schema(SAMPLE_MANIFEST, _FLATTENER, artifact_type="defect")
        keys = [f.key for f in schema.fields]
        assert "severity" in keys
        assert "detected_by" in keys
        assert "story_points" not in keys
        severity = next(f for f in schema.fields if f.key == "severity")
        detected = next(f for f in schema.fields if f.key == "detected_by")
        assert severity.visible_when is None
        assert detected.visible_when is None

    def test_build_form_schema_passes_artifact_type_to_create(self):
        schema = build_form_schema(SAMPLE_MANIFEST, "artifact", "create", _FLATTENER, artifact_type="defect")
        assert schema is not None
        assert len(schema.artifact_type_options) == 1
        assert schema.artifact_type_options[0]["id"] == "defect"

    def test_exclude_from_form_schema_omits_field(self):
        create_keys = [f.key for f in build_artifact_create_form_schema(SAMPLE_MANIFEST, _FLATTENER).fields]
        assert "ot_excluded_json_slot" not in create_keys
        edit = build_artifact_edit_form_schema(SAMPLE_MANIFEST, _FLATTENER, artifact_type="defect")
        edit_keys = [f.key for f in edit.fields]
        assert "ot_excluded_json_slot" not in edit_keys

    def test_artifact_edit_includes_tag_ids(self):
        schema = build_artifact_edit_form_schema(SAMPLE_MANIFEST, _FLATTENER, artifact_type="defect")
        tag_field = next(f for f in schema.fields if f.key == "tag_ids")
        assert tag_field.type == "tag_list"
        assert tag_field.label_key == "Tags"

    def test_visible_when_normalized(self):
        schema = build_artifact_create_form_schema(SAMPLE_MANIFEST, _FLATTENER)
        severity_field = next(f for f in schema.fields if f.key == "severity")
        assert severity_field.visible_when is not None
        assert severity_field.visible_when["field"] == "artifact_type"
        assert severity_field.visible_when["in"] == ["defect"]
        assert severity_field.type == "choice"
        assert severity_field.options == [{"id": "low", "label": "Low"}, {"id": "high", "label": "High"}]

    def test_required_when_normalized(self):
        schema = build_artifact_create_form_schema(SAMPLE_MANIFEST, _FLATTENER)
        story_points_field = next(f for f in schema.fields if f.key == "story_points")
        assert story_points_field.required_when is not None
        assert story_points_field.required_when["field"] == "artifact_type"
        assert story_points_field.required_when["eq"] == "feature"

    def test_build_form_schema_artifact_create(self):
        schema = build_form_schema(SAMPLE_MANIFEST, "artifact", "create", _FLATTENER)
        assert schema is not None
        assert schema.entity_type == "artifact"

    def test_build_form_schema_unknown(self):
        assert build_form_schema(SAMPLE_MANIFEST, "unknown", "create", _FLATTENER) is None
        # artifact/edit is supported and returns a form schema
        schema = build_form_schema(SAMPLE_MANIFEST, "artifact", "edit", _FLATTENER)
        assert schema is not None
        assert schema.entity_type == "artifact"
        assert schema.context == "edit"

    def test_build_task_create_form_schema(self):
        schema = build_task_create_form_schema({})
        assert schema.entity_type == "task"
        assert schema.context == "create"
        assert schema.artifact_type_options == ()
        field_keys = [f.key for f in schema.fields]
        assert field_keys == ["title", "description", "state", "assignee_id", "tag_ids", "rank_order"]
        state_field = next(f for f in schema.fields if f.key == "state")
        assert state_field.type == "choice"
        assert state_field.default_value == "todo"

    def test_build_form_schema_task_create_and_edit(self):
        assert build_form_schema({}, "task", "create", _FLATTENER) is not None
        assert build_form_schema({}, "task", "edit", _FLATTENER) is not None
        schema = build_form_schema({}, "task", "create", _FLATTENER)
        assert schema.entity_type == "task"
        assert schema.context == "create"

    def test_build_task_form_from_manifest_workflow(self):
        schema = build_task_create_form_schema(FORM_SCHEMA_TASK_WORKFLOW_MANIFEST)
        state_field = next(f for f in schema.fields if f.key == "state")
        assert state_field.default_value == "backlog"
        assert {o["id"] for o in (state_field.options or [])} == {"backlog", "wip"}

"""Build form schema from manifest bundle (defs format)."""
from __future__ import annotations

from alm.form_schema.domain.entities import FormFieldSchema, FormSchema
from alm.artifact.domain.mpc_resolver import manifest_defs_to_flat


def _humanize_id(obj_id: str) -> str:
    """Convert snake_case or kebab-case id to Title Case."""
    if not obj_id:
        return ""
    return obj_id.replace("_", " ").replace("-", " ").title()


def build_artifact_create_form_schema(manifest_bundle: dict) -> FormSchema:
    """Build form schema for artifact create context from manifest."""
    flat = manifest_defs_to_flat(manifest_bundle or {})
    artifact_types = flat.get("artifact_types", [])

    type_options = [
        {"id": at["id"], "label": at.get("name") or _humanize_id(at["id"])}
        for at in artifact_types
    ]

    fields: list[FormFieldSchema] = []

    # typeName (artifact type) - choice, required
    fields.append(
        FormFieldSchema(
            key="artifact_type",
            type="choice",
            label_key="Type",
            required=True,
            options=type_options,
            default_value=artifact_types[0]["id"] if artifact_types else "",
            order=0,
        )
    )

    # parent_id - entity_ref artifact
    fields.append(
        FormFieldSchema(
            key="parent_id",
            type="entity_ref",
            label_key="Parent (optional)",
            required=False,
            entity_ref="artifact",
            order=10,
        )
    )

    # title - string, required
    fields.append(
        FormFieldSchema(
            key="title",
            type="string",
            label_key="Title",
            required=True,
            order=20,
        )
    )

    # description - string
    fields.append(
        FormFieldSchema(
            key="description",
            type="string",
            label_key="Description",
            required=False,
            order=30,
        )
    )

    # assignee_id - entity_ref user (optional)
    fields.append(
        FormFieldSchema(
            key="assignee_id",
            type="entity_ref",
            label_key="Assignee (optional)",
            required=False,
            entity_ref="user",
            order=35,
        )
    )

    # Custom fields from all artifact types (merged; type-specific via visibleWhen)
    order = 40
    seen_keys: set[str] = set()
    for at in artifact_types:
        for f in at.get("fields", []) or []:
            fid = f.get("id")
            if not fid or fid in seen_keys:
                continue
            seen_keys.add(fid)

            visible_when = f.get("visibleWhen") or f.get("visible_when")
            required_when = f.get("requiredWhen") or f.get("required_when")

            # Normalize condition field: typeName -> artifact_type (form key)
            def _norm_condition(c: dict | None) -> dict | None:
                if not c or not isinstance(c, dict):
                    return c
                out = dict(c)
                if out.get("field") == "typeName":
                    out["field"] = "artifact_type"
                return out

            visible_when = _norm_condition(visible_when)
            required_when = _norm_condition(required_when)

            field_type = f.get("type", "string")
            options = None
            if field_type == "choice" and f.get("options"):
                options = [
                    {"id": str(o.get("id", o.get("value", ""))), "label": str(o.get("label", o.get("name", o.get("id", ""))))}
                    for o in (f["options"] if isinstance(f["options"], list) else [])
                    if isinstance(o, dict)
                ]

            fields.append(
                FormFieldSchema(
                    key=fid,
                    type=field_type,
                    label_key=f.get("name") or _humanize_id(str(fid)),
                    required=bool(f.get("required", False)),
                    order=order,
                    visible_when=visible_when,
                    required_when=required_when,
                    options=options,
                )
            )
            order += 1

    # Sort by order
    fields.sort(key=lambda f: (f.order, f.key))

    return FormSchema(
        entity_type="artifact",
        context="create",
        fields=tuple(fields),
        artifact_type_options=tuple(
            {"id": o["id"], "label": o["label"]} for o in type_options
        ),
    )


# Fixed task state options for form (no manifest dependency)
_TASK_STATE_OPTIONS = [
    {"id": "todo", "label": "To do"},
    {"id": "in_progress", "label": "In progress"},
    {"id": "done", "label": "Done"},
]


def build_task_create_form_schema() -> FormSchema:
    """Build fixed form schema for task create context (P3 — Task form/list schema)."""
    fields: list[FormFieldSchema] = [
        FormFieldSchema(
            key="title",
            type="string",
            label_key="Title",
            required=True,
            order=10,
        ),
        FormFieldSchema(
            key="description",
            type="string",
            label_key="Description",
            required=False,
            order=20,
        ),
        FormFieldSchema(
            key="state",
            type="choice",
            label_key="State",
            required=True,
            options=_TASK_STATE_OPTIONS,
            default_value="todo",
            order=30,
        ),
        FormFieldSchema(
            key="assignee_id",
            type="entity_ref",
            label_key="Assignee (optional)",
            required=False,
            entity_ref="user",
            order=40,
        ),
        FormFieldSchema(
            key="rank_order",
            type="number",
            label_key="Rank order",
            required=False,
            order=50,
        ),
    ]
    return FormSchema(
        entity_type="task",
        context="create",
        fields=tuple(fields),
        artifact_type_options=(),
    )


def build_form_schema(
    manifest_bundle: dict,
    entity_type: str,
    context: str,
) -> FormSchema | None:
    """Build form schema for given entity type and context."""
    if entity_type == "artifact" and context == "create":
        return build_artifact_create_form_schema(manifest_bundle)
    if entity_type == "task" and context in ("create", "edit"):
        return build_task_create_form_schema()
    return None

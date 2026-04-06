"""Build form schema from manifest bundle (defs format)."""

from __future__ import annotations

from dataclasses import replace
from typing import Any

from alm.artifact.domain.manifest_workflow_metadata import (
    get_task_state_options_and_initial,
    planning_area_field_allowed,
    planning_cycle_field_allowed,
)
from alm.form_schema.domain.entities import FormFieldSchema, FormSchema, LookupSchema
from alm.shared.domain.ports import IManifestDefsFlattener
from alm.task.domain.task_activity import task_activity_options

_CREATE_ARTIFACT_CORE_KEYS = frozenset({"artifact_type", "parent_id", "title", "description", "assignee_id"})


def _condition_only_matches_artifact_type(cond: dict[str, Any] | None, at_filter: str) -> bool:
    """True when the condition is equivalent to artifact_type == at_filter (narrowed create)."""
    if not cond or not isinstance(cond, dict):
        return False
    field = cond.get("field")
    if field not in ("artifact_type", "typeName"):
        return False
    if "in" in cond:
        vals = cond["in"]
        if not isinstance(vals, list) or not vals:
            return False
        return {str(v).strip() for v in vals} == {at_filter}
    eq_val = cond.get("eq")
    if eq_val is not None:
        return str(eq_val).strip() == at_filter
    return False


def _strip_redundant_type_conditions(fld: FormFieldSchema, at_filter: str) -> FormFieldSchema:
    """Drop visible_when/required_when that only restate the narrowed artifact_type (form UX + eval)."""
    vw = fld.visible_when
    rw = fld.required_when
    new_vw = None if _condition_only_matches_artifact_type(vw, at_filter) else vw
    new_rw = None if _condition_only_matches_artifact_type(rw, at_filter) else rw
    if new_vw != vw or new_rw != rw:
        return replace(fld, visible_when=new_vw, required_when=new_rw)
    return fld


def _manifest_field_excluded_from_forms(field_def: dict[str, Any]) -> bool:
    """When true, field is documented on the artifact type but omitted from create/edit form schemas."""
    return bool(field_def.get("exclude_from_form_schema") or field_def.get("excludeFromFormSchema"))


def _artifact_type_declares_field(artifact_types: list[dict[str, Any]], type_id: str, field_key: str) -> bool:
    for at in artifact_types:
        if not isinstance(at, dict) or at.get("id") != type_id:
            continue
        for fld in at.get("fields") or []:
            if isinstance(fld, dict) and fld.get("id") == field_key:
                return True
    return False


def _norm_manifest_condition(c: dict[str, Any] | None) -> dict[str, Any] | None:
    """Map manifest condition field names to form value keys (create + edit)."""
    if not c or not isinstance(c, dict):
        return c
    out = dict(c)
    if out.get("field") == "typeName":
        out["field"] = "artifact_type"
    return out


def _humanize_id(obj_id: str) -> str:
    """Convert snake_case or kebab-case id to Title Case."""
    if not obj_id:
        return ""
    return obj_id.replace("_", " ").replace("-", " ").title()


def _infer_lookup(field_type: str, entity_ref: str | None = None) -> LookupSchema | None:
    if field_type == "tag_list":
        return LookupSchema(kind="tag", multi=True, label_field="label", value_field="id")
    if field_type == "entity_ref" and entity_ref:
        return LookupSchema(kind=entity_ref, label_field="label", value_field="id")
    return None


def _editable_surfaces(*surfaces: str) -> tuple[str, ...]:
    return tuple(dict.fromkeys(("form", *surfaces)))


def _manifest_write_target(field_key: str) -> str:
    root_fields = {"title", "description", "assignee_id", "team_id", "cycle_id", "area_node_id", "tag_ids", "state", "rank_order"}
    return "root" if field_key in root_fields else "custom_field"


def build_artifact_create_form_schema(
    manifest_bundle: dict[str, Any],
    flattener: IManifestDefsFlattener,
    artifact_type: str | None = None,
) -> FormSchema:
    """Build form schema for artifact create context from manifest.

    When ``artifact_type`` is set to a known manifest type id, returned schema
    narrows the type choice to that id and omits custom fields declared only on
    other artifact types (merged create form otherwise shows every manifest field).
    """
    flat = flattener.flatten(manifest_bundle or {})
    artifact_types = flat.get("artifact_types", [])

    type_options = [{"id": at["id"], "label": at.get("name") or _humanize_id(at["id"])} for at in artifact_types]

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
            editable=False,
            surfaces=("form",),
            write_target="root",
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
            editable=True,
            surfaces=("form",),
            lookup=_infer_lookup("entity_ref", "artifact"),
            write_target="root",
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
            editable=True,
            surfaces=_editable_surfaces("tabular", "detail"),
            write_target="root",
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
            editable=True,
            surfaces=("form", "detail"),
            write_target="root",
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
            editable=True,
            surfaces=_editable_surfaces("tabular", "detail"),
            lookup=_infer_lookup("entity_ref", "user"),
            write_target="root",
        )
    )

    # team_id - entity_ref team (optional)
    fields.append(
        FormFieldSchema(
            key="team_id",
            type="entity_ref",
            label_key="Team (optional)",
            required=False,
            entity_ref="team",
            order=38,
            editable=True,
            surfaces=("form", "detail"),
            lookup=_infer_lookup("entity_ref", "team"),
            write_target="root",
        )
    )

    # Custom fields from all artifact types (merged; type-specific via visibleWhen)
    order = 40
    seen_keys: set[str] = set()
    for at in artifact_types:
        for f in at.get("fields", []) or []:
            if not isinstance(f, dict):
                continue
            fid = f.get("id")
            if not fid or fid in seen_keys:
                continue
            if _manifest_field_excluded_from_forms(f):
                continue
            seen_keys.add(fid)

            visible_when = _norm_manifest_condition(f.get("visibleWhen") or f.get("visible_when"))
            required_when = _norm_manifest_condition(f.get("requiredWhen") or f.get("required_when"))

            field_type = f.get("type", "string")
            options = None
            if field_type == "choice" and f.get("options"):
                options = [
                    {
                        "id": str(o.get("id", o.get("value", ""))),
                        "label": str(o.get("label", o.get("name", o.get("id", "")))),
                    }
                    for o in (f["options"] if isinstance(f["options"], list) else [])
                    if isinstance(o, dict)
                ]

            entity_ref_val = None
            allowed_parent_types_val = None
            if field_type == "entity_ref":
                raw_er = f.get("entity_ref")
                entity_ref_val = str(raw_er).strip() if raw_er else None
                raw_pt = f.get("allowed_parent_types") or f.get("allowedParentTypes")
                if isinstance(raw_pt, list):
                    allowed_parent_types_val = [str(x).strip() for x in raw_pt if str(x).strip()]
                    if not allowed_parent_types_val:
                        allowed_parent_types_val = None

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
                    entity_ref=entity_ref_val,
                    allowed_parent_types=allowed_parent_types_val,
                    editable=True,
                    surfaces=("form",),
                    lookup=_infer_lookup(field_type, entity_ref_val),
                    write_target=_manifest_write_target(str(fid)),
                )
            )
            order += 1

    # Sort by order
    fields.sort(key=lambda f: (f.order, f.key))

    at_filter = (artifact_type or "").strip()
    known_ids = {at["id"] for at in artifact_types if isinstance(at, dict) and at.get("id")}
    if at_filter and at_filter in known_ids:
        single_opt = next((o for o in type_options if o["id"] == at_filter), None)
        label = single_opt["label"] if single_opt else _humanize_id(at_filter)
        narrowed_options = ({"id": at_filter, "label": label},)
        narrowed_fields: list[FormFieldSchema] = []
        for fld in fields:
            if fld.key in _CREATE_ARTIFACT_CORE_KEYS:
                if fld.key == "artifact_type":
                    narrowed_fields.append(
                        FormFieldSchema(
                            key="artifact_type",
                            type="choice",
                            label_key="Type",
                            required=True,
                            options=[{"id": at_filter, "label": label}],
                            default_value=at_filter,
                            order=fld.order,
                            editable=False,
                            surfaces=("form",),
                            write_target="root",
                        )
                    )
                else:
                    narrowed_fields.append(fld)
            elif _artifact_type_declares_field(artifact_types, at_filter, fld.key):
                narrowed_fields.append(_strip_redundant_type_conditions(fld, at_filter))
        fields = narrowed_fields
        type_options = list(narrowed_options)

    return FormSchema(
        entity_type="artifact",
        context="create",
        fields=tuple(fields),
        artifact_type_options=tuple({"id": o["id"], "label": o["label"]} for o in type_options),
    )


def build_artifact_edit_form_schema(
    manifest_bundle: dict[str, Any],
    flattener: IManifestDefsFlattener,
    artifact_type: str | None = None,
) -> FormSchema:
    """Build form schema for artifact edit context.

    Returns core fields (title, description, assignee, cycle, area, project tags)
    plus any custom fields defined in the manifest for the given artifact_type.
    """
    core_keys = {"title", "description", "assignee_id", "cycle_id", "area_node_id", "tag_ids"}

    fields: list[FormFieldSchema] = [
        FormFieldSchema(
            key="title",
            type="string",
            label_key="Title",
            required=True,
            order=10,
            editable=True,
            surfaces=_editable_surfaces("tabular", "detail"),
            write_target="root",
        ),
        FormFieldSchema(
            key="description",
            type="string",
            label_key="Description",
            required=False,
            order=20,
            editable=True,
            surfaces=("form", "detail"),
            write_target="root",
        ),
        FormFieldSchema(
            key="assignee_id",
            type="entity_ref",
            label_key="Assignee (optional)",
            required=False,
            entity_ref="user",
            order=30,
            editable=True,
            surfaces=_editable_surfaces("tabular", "detail"),
            lookup=_infer_lookup("entity_ref", "user"),
            write_target="root",
        ),
        FormFieldSchema(
            key="team_id",
            type="entity_ref",
            label_key="Team (optional)",
            required=False,
            entity_ref="team",
            order=35,
            editable=True,
            surfaces=("form", "detail"),
            lookup=_infer_lookup("entity_ref", "team"),
            write_target="root",
        ),
    ]
    at_key = artifact_type or ""
    if not artifact_type or planning_cycle_field_allowed(manifest_bundle, at_key):
        fields.append(
            FormFieldSchema(
                key="cycle_id",
                type="entity_ref",
                label_key="Cycle",
                required=False,
                entity_ref="cycle",
                order=40,
                editable=True,
                surfaces=_editable_surfaces("tabular", "detail"),
                lookup=_infer_lookup("entity_ref", "cycle"),
                write_target="root",
            )
        )
    if not artifact_type or planning_area_field_allowed(manifest_bundle, at_key):
        fields.append(
            FormFieldSchema(
                key="area_node_id",
                type="entity_ref",
                label_key="Area",
                required=False,
                entity_ref="area",
                order=50,
                editable=True,
                surfaces=_editable_surfaces("tabular", "detail"),
                lookup=_infer_lookup("entity_ref", "area"),
                write_target="root",
            )
        )

    fields.append(
        FormFieldSchema(
            key="tag_ids",
            type="tag_list",
            label_key="Tags",
            required=False,
            order=55,
            editable=True,
            surfaces=_editable_surfaces("tabular", "detail"),
            lookup=_infer_lookup("tag_list"),
            write_target="root",
        )
    )

    if artifact_type and manifest_bundle:
        flat = flattener.flatten(manifest_bundle)
        artifact_types = flat.get("artifact_types") or []
        at_def = next((a for a in artifact_types if isinstance(a, dict) and a.get("id") == artifact_type), None)
        if at_def:
            order = 100
            for f in at_def.get("fields") or []:
                if not isinstance(f, dict):
                    continue
                fid = f.get("id")
                if not fid or fid in core_keys:
                    continue
                if _manifest_field_excluded_from_forms(f):
                    continue
                field_type = f.get("type", "string")
                options = None
                if field_type == "choice" and f.get("options"):
                    options = [
                        {
                            "id": str(o.get("id", o.get("value", ""))),
                            "label": str(o.get("label", o.get("name", o.get("id", "")))),
                        }
                        for o in (f["options"] if isinstance(f["options"], list) else [])
                        if isinstance(o, dict)
                    ]
                entity_ref_val = None
                allowed_parent_types_val = None
                if field_type == "entity_ref":
                    raw_er = f.get("entity_ref")
                    entity_ref_val = str(raw_er).strip() if raw_er else None
                    raw_pt = f.get("allowed_parent_types") or f.get("allowedParentTypes")
                    if isinstance(raw_pt, list):
                        allowed_parent_types_val = [str(x).strip() for x in raw_pt if str(x).strip()]
                        if not allowed_parent_types_val:
                            allowed_parent_types_val = None
                v_when = _norm_manifest_condition(f.get("visibleWhen") or f.get("visible_when"))
                r_when = _norm_manifest_condition(f.get("requiredWhen") or f.get("required_when"))
                fields.append(
                    FormFieldSchema(
                        key=fid,
                        type=field_type,
                        label_key=f.get("name") or _humanize_id(str(fid)),
                        required=bool(f.get("required", False)),
                        order=order,
                        visible_when=v_when,
                        required_when=r_when,
                        options=options,
                        entity_ref=entity_ref_val,
                        allowed_parent_types=allowed_parent_types_val,
                        editable=True,
                        surfaces=_editable_surfaces("tabular", "detail"),
                        lookup=_infer_lookup(field_type, entity_ref_val),
                        write_target=_manifest_write_target(str(fid)),
                    )
                )
                order += 1

    return FormSchema(
        entity_type="artifact",
        context="edit",
        fields=tuple(fields),
        artifact_type_options=(),
    )


def build_task_create_form_schema(manifest_bundle: dict[str, Any] | None = None) -> FormSchema:
    """Build task create/edit form schema from manifest ``task_workflow_id`` (fallback if missing)."""
    task_opts, initial_state = get_task_state_options_and_initial(manifest_bundle)
    fields: list[FormFieldSchema] = [
        FormFieldSchema(
            key="title",
            type="string",
            label_key="Title",
            required=True,
            order=10,
            editable=True,
            surfaces=_editable_surfaces("tabular", "detail"),
            write_target="root",
        ),
        FormFieldSchema(
            key="description",
            type="string",
            label_key="Description",
            required=False,
            order=20,
            editable=True,
            surfaces=("form", "detail"),
            write_target="root",
        ),
        FormFieldSchema(
            key="state",
            type="choice",
            label_key="State",
            required=True,
            options=task_opts,
            default_value=initial_state,
            order=30,
            editable=True,
            surfaces=_editable_surfaces("tabular", "detail"),
            write_target="root",
        ),
        FormFieldSchema(
            key="assignee_id",
            type="entity_ref",
            label_key="Assignee (optional)",
            required=False,
            entity_ref="user",
            order=40,
            editable=True,
            surfaces=_editable_surfaces("tabular", "detail"),
            lookup=_infer_lookup("entity_ref", "user"),
            write_target="root",
        ),
        FormFieldSchema(
            key="team_id",
            type="entity_ref",
            label_key="Team (optional)",
            required=False,
            entity_ref="team",
            order=42,
            editable=True,
            surfaces=("form", "detail"),
            lookup=_infer_lookup("entity_ref", "team"),
            write_target="root",
        ),
        FormFieldSchema(
            key="original_estimate_hours",
            type="number",
            label_key="Original estimate (hours)",
            required=False,
            order=43,
            editable=True,
            surfaces=_editable_surfaces("tabular", "detail"),
            write_target="root",
        ),
        FormFieldSchema(
            key="remaining_work_hours",
            type="number",
            label_key="Remaining work (hours)",
            required=False,
            order=44,
            editable=True,
            surfaces=_editable_surfaces("tabular", "detail"),
            write_target="root",
        ),
        FormFieldSchema(
            key="activity",
            type="choice",
            label_key="Activity",
            required=False,
            options=task_activity_options(),
            order=45,
            editable=True,
            surfaces=_editable_surfaces("tabular", "detail"),
            write_target="root",
        ),
        FormFieldSchema(
            key="tag_ids",
            type="tag_list",
            label_key="Tags",
            required=False,
            order=46,
            editable=True,
            surfaces=_editable_surfaces("tabular", "detail"),
            lookup=_infer_lookup("tag_list"),
            write_target="root",
        ),
    ]
    return FormSchema(
        entity_type="task",
        context="create",
        fields=tuple(fields),
        artifact_type_options=(),
    )


def build_form_schema(
    manifest_bundle: dict[str, Any],
    entity_type: str,
    context: str,
    flattener: IManifestDefsFlattener,
    artifact_type: str | None = None,
) -> FormSchema | None:
    """Build form schema for given entity type and context."""
    if entity_type == "artifact" and context == "create":
        return build_artifact_create_form_schema(manifest_bundle, flattener, artifact_type=artifact_type)
    if entity_type == "artifact" and context == "edit":
        return build_artifact_edit_form_schema(manifest_bundle, flattener, artifact_type=artifact_type)
    if entity_type == "task" and context in ("create", "edit"):
        return build_task_create_form_schema(manifest_bundle)
    return None

# Defect fields: OpenText-style parity in process templates

Quality defect create uses the global **artifact create** form schema (`GET .../form-schema?entity_type=artifact&context=create`). Type-specific inputs come from `artifact_types[].fields` on the **defect** or **bug** manifest type, with `visibleWhen` / `requiredWhen` using `field: typeName` (the form builder normalizes this to `artifact_type`).

## Core mapping (built-in form keys)

| Concept | Manifest / API |
|--------|----------------|
| Summary | `title` |
| Description | `description` |
| Subject / folder | `parent_id` (under `root-defect` or defect folders if `child_types` allow) |
| Status | Workflow initial state after create |
| Assigned To | `assignee_id` |

## Example custom fields (`defs` fragment)

Use distinct field ids (e.g. `defect_priority`) so they do not collide with `priority` on other types in the same merged create schema.

See seeded templates in `alm-app/backend/src/alm/config/seed.py` (`_open_text_defect_parity_fields`) for a full list: severity, priority (1–5), detected by (`entity_ref: user`), dates, versions, environment, release/cycle strings, reproducible, and fix-time numbers.

**Comments:** Work-item discussion uses the first-class **artifact comments** API (`GET/POST .../artifacts/{id}/comments`), not manifest JSON fields. The Artifacts detail drawer, Quality test case detail, and Quality Defects “add comment” flow all use that endpoint (`artifact:comment` permission to post).

Optional query `artifact_type=defect` (or `bug`) narrows the create schema to that type and its custom fields only.

Quality **Defects** list supports `?under=<artifact-uuid>` to scope the list and default **New defect** parent to that folder (same idea as Artifacts quality `under`).

**Find similar:** sets the list search query (`q`) from significant words in the defect title, using the same artifact list API (no new backend endpoint).

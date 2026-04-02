"""Central manifest bundles for unit tests.

Keep domain-specific scenarios here so tests import one canonical definition
and assertions stay aligned when manifests evolve.
"""

from __future__ import annotations

from typing import Any

# ---------------------------------------------------------------------------
# Form schema builder (epic / feature / defect + conditional fields)
# ---------------------------------------------------------------------------
FORM_SCHEMA_BUILDER_MANIFEST: dict[str, Any] = {
    "defs": [
        {
            "kind": "Workflow",
            "id": "basic",
            "states": ["new", "active"],
            "transitions": [{"from": "new", "to": "active"}],
        },
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
                {
                    "id": "story_points",
                    "name": "Story Points",
                    "type": "number",
                    "requiredWhen": {"field": "typeName", "eq": "feature"},
                },
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
                {
                    "id": "detected_by",
                    "name": "Detected by",
                    "type": "entity_ref",
                    "entity_ref": "user",
                    "visibleWhen": {"field": "typeName", "in": ["defect"]},
                },
                {
                    "id": "ot_excluded_json_slot",
                    "name": "App-managed JSON",
                    "type": "string",
                    "visibleWhen": {"field": "typeName", "in": ["defect"]},
                    "exclude_from_form_schema": True,
                },
            ],
        },
    ],
}

# ---------------------------------------------------------------------------
# MPC resolver: hierarchy, TransitionPolicy, workflow with explicit triggers
# ---------------------------------------------------------------------------
MPC_RESOLVER_SAMPLE_MANIFEST: dict[str, Any] = {
    "schemaVersion": 1,
    "namespace": "alm",
    "name": "basic",
    "manifestVersion": "1.0.0",
    "defs": [
        {
            "kind": "Workflow",
            "id": "basic",
            "initial": "new",
            "finals": ["closed"],
            "states": ["new", "active", "resolved", "closed"],
            "transitions": [
                {"from": "new", "to": "active", "on": "start", "on_enter": ["log_transition"]},
                {"from": "active", "to": "resolved", "on": "resolve"},
                {"from": "resolved", "to": "closed", "on": "close"},
                {"from": "closed", "to": "active", "on": "reopen"},
            ],
        },
        {
            "kind": "ArtifactType",
            "id": "requirement",
            "workflow_id": "basic",
            "parent_types": ["feature", "epic"],
            "fields": [{"id": "priority", "name": "Priority", "type": "string"}],
        },
        {
            "kind": "ArtifactType",
            "id": "feature",
            "workflow_id": "basic",
            "parent_types": ["epic"],
            "child_types": ["requirement"],
        },
        {
            "kind": "ArtifactType",
            "id": "epic",
            "workflow_id": "basic",
            "child_types": ["feature"],
        },
        {
            "kind": "TransitionPolicy",
            "id": "assignee_active",
            "when": {"state": "active"},
            "require": "assignee",
        },
    ],
}

# ---------------------------------------------------------------------------
# manifest_defs_to_flat — link types and trigger preservation
# ---------------------------------------------------------------------------
MANIFEST_DEFS_LINK_TYPES_SIMPLE: dict[str, Any] = {
    "defs": [
        {"kind": "LinkType", "id": "blocks", "name": "Blocks"},
        {"kind": "LinkType", "id": "relates-to", "name": "Relates To"},
    ],
}

MANIFEST_DEFS_LINK_TYPE_BLOCKS_RICH: dict[str, Any] = {
    "defs": [
        {
            "kind": "LinkType",
            "id": "blocks",
            "name": "Blocks",
            "direction": "directed",
            "cardinality": "many-to-many",
            "from_types": ["feature"],
            "to_types": ["requirement"],
            "description": "Feature blocks requirement",
        },
    ],
}

MANIFEST_DEFS_WORKFLOW_TRIGGER_LABEL: dict[str, Any] = {
    "defs": [
        {
            "kind": "Workflow",
            "id": "w",
            "initial": "new",
            "states": ["new", "active"],
            "transitions": [
                {"from": "new", "to": "active", "trigger": "start", "trigger_label": "Start"},
            ],
        },
        {"kind": "ArtifactType", "id": "req", "workflow_id": "w"},
    ],
}

# ---------------------------------------------------------------------------
# MPC features: ACL + Redact (no ArtifactType / Workflow)
# ---------------------------------------------------------------------------
MPC_ACL_REDACT_MANIFEST: dict[str, Any] = {
    "schemaVersion": 1,
    "namespace": "alm",
    "name": "test",
    "manifestVersion": "1.0.0",
    "defs": [
        {
            "kind": "ACL",
            "id": "acl_read",
            "action": "read",
            "resource": "artifact",
            "roles": ["viewer"],
            "effect": "allow",
        },
        {
            "kind": "ACL",
            "id": "acl_update",
            "action": "update",
            "resource": "artifact",
            "roles": ["editor"],
            "effect": "allow",
        },
        {
            "kind": "ACL",
            "id": "acl_delete",
            "action": "delete",
            "resource": "artifact",
            "roles": ["admin"],
            "effect": "allow",
        },
        {
            "kind": "Redact",
            "id": "artifact_redact",
            "rules": [
                {"field": "internal_notes", "roles": ["viewer"], "effect": "mask"},
                {"field": "confidential_data", "roles": ["viewer", "editor"], "effect": "mask"},
            ],
        },
    ],
}

MPC_WORKFLOW_REQ_FLOW_MANIFEST: dict[str, Any] = {
    "schemaVersion": 1,
    "namespace": "alm",
    "name": "workflow",
    "manifestVersion": "1.0.0",
    "defs": [
        {"kind": "ArtifactType", "id": "requirement", "workflow_id": "req_flow"},
        {
            "kind": "Workflow",
            "id": "req_flow",
            "initial": "open",
            "states": ["open", "in_progress", "closed"],
            "finals": ["closed"],
            "transitions": [
                {"from": "open", "on": "start", "to": "in_progress"},
                {"from": "in_progress", "on": "close", "to": "closed"},
                {"from": "open", "on": "close", "to": "closed"},
            ],
        },
    ],
}

# ---------------------------------------------------------------------------
# Policy / AST contract (minimal)
# ---------------------------------------------------------------------------
MPC_CONTRACT_MINIMAL_MANIFEST: dict[str, Any] = {
    "defs": [
        {
            "kind": "Workflow",
            "id": "w",
            "initial": "new",
            "states": ["new", "active"],
            "transitions": [{"from": "new", "to": "active", "on": "go"}],
        },
        {"kind": "ArtifactType", "id": "t", "workflow_id": "w"},
    ],
}

# ---------------------------------------------------------------------------
# TransitionArtifactHandler + permitted triggers integration-style unit tests
# ---------------------------------------------------------------------------
TRANSITION_MANIFEST_TRIGGER_LABELS: dict[str, Any] = {
    "defs": [
        {
            "kind": "Workflow",
            "id": "basic",
            "initial": "new",
            "states": ["new", "active", "resolved"],
            "transitions": [
                {"from": "new", "to": "active", "trigger": "start", "trigger_label": "Start"},
                {"from": "active", "to": "resolved", "trigger": "resolve", "trigger_label": "Resolve"},
            ],
        },
        {"kind": "ArtifactType", "id": "requirement", "workflow_id": "basic"},
    ],
}

TRANSITION_MANIFEST_ASSIGNEE_POLICY: dict[str, Any] = {
    "defs": [
        {
            "kind": "Workflow",
            "id": "basic",
            "initial": "new",
            "states": ["new", "active", "resolved"],
            "transitions": [
                {"from": "new", "to": "active"},
                {"from": "active", "to": "resolved"},
            ],
        },
        {"kind": "ArtifactType", "id": "requirement", "workflow_id": "basic"},
        {"kind": "TransitionPolicy", "id": "assignee_active", "when": {"state": "active"}, "require": "assignee"},
    ],
}

TRANSITION_MANIFEST_GUARD_ASSIGNEE: dict[str, Any] = {
    "defs": [
        {
            "kind": "Workflow",
            "id": "basic",
            "initial": "new",
            "states": ["new", "active", "resolved"],
            "transitions": [
                {"from": "new", "to": "active", "guard": "assignee_required"},
                {"from": "active", "to": "resolved"},
            ],
        },
        {"kind": "ArtifactType", "id": "requirement", "workflow_id": "basic"},
    ],
}

# ---------------------------------------------------------------------------
# workflow_sm adapter (implicit triggers, no TransitionPolicy)
# ---------------------------------------------------------------------------
WORKFLOW_SM_BASIC_MANIFEST: dict[str, Any] = {
    "defs": [
        {
            "kind": "Workflow",
            "id": "basic",
            "initial": "new",
            "states": ["new", "active", "resolved", "closed"],
            "transitions": [
                {"from": "new", "to": "active", "on_enter": ["log_transition"]},
                {"from": "active", "to": "resolved"},
                {"from": "resolved", "to": "closed"},
                {"from": "closed", "to": "active"},
            ],
        },
        {"kind": "ArtifactType", "id": "requirement", "workflow_id": "basic"},
    ],
}

WORKFLOW_SM_GUARD_FILTER_MANIFEST: dict[str, Any] = {
    "defs": [
        {
            "kind": "Workflow",
            "id": "basic",
            "initial": "new",
            "states": ["new", "active"],
            "transitions": [
                {"from": "new", "to": "active", "guard": "assignee_required"},
            ],
        },
        {"kind": "ArtifactType", "id": "requirement", "workflow_id": "basic"},
    ],
}

# ---------------------------------------------------------------------------
# Quality tree parent rules (test-case vs testsuite-folder)
# ---------------------------------------------------------------------------
QUALITY_PARENT_RULES_MANIFEST_BUNDLE: dict[str, Any] = {
    "defs": [
        {"kind": "Workflow", "id": "root", "initial": "Active", "states": ["Active"], "transitions": []},
        {"kind": "Workflow", "id": "basic", "initial": "new", "states": ["new", "done"], "transitions": []},
        {"kind": "ArtifactType", "id": "root-quality", "workflow_id": "root", "child_types": ["quality-folder"]},
        {"kind": "ArtifactType", "id": "root-testsuites", "workflow_id": "root", "child_types": ["testsuite-folder"]},
        {
            "kind": "ArtifactType",
            "id": "quality-folder",
            "workflow_id": "root",
            "parent_types": ["root-quality", "quality-folder"],
            "child_types": ["quality-folder", "test-case"],
        },
        {
            "kind": "ArtifactType",
            "id": "testsuite-folder",
            "workflow_id": "root",
            "parent_types": ["root-testsuites", "testsuite-folder"],
            "child_types": ["testsuite-folder", "test-suite", "test-run", "test-campaign"],
        },
        {
            "kind": "ArtifactType",
            "id": "test-case",
            "workflow_id": "basic",
            "parent_types": ["root-quality", "quality-folder"],
            "child_types": [],
        },
        {
            "kind": "ArtifactType",
            "id": "test-suite",
            "workflow_id": "basic",
            "parent_types": ["root-testsuites", "testsuite-folder"],
            "child_types": [],
        },
        {
            "kind": "ArtifactType",
            "id": "test-run",
            "workflow_id": "basic",
            "parent_types": ["root-testsuites", "testsuite-folder"],
            "child_types": [],
        },
        {
            "kind": "ArtifactType",
            "id": "test-campaign",
            "workflow_id": "basic",
            "parent_types": ["root-testsuites", "testsuite-folder"],
            "child_types": [],
        },
    ],
}


WORKFLOW_SM_TRANSITION_GUARD_LOOKUP_MANIFEST: dict[str, Any] = {
    "defs": [
        {
            "kind": "Workflow",
            "id": "basic",
            "states": ["new", "active"],
            "transitions": [
                {"from": "new", "to": "active", "guard": "assignee_required"},
                {"from": "active", "to": "new"},
            ],
        },
        {"kind": "ArtifactType", "id": "requirement", "workflow_id": "basic"},
    ],
}

# ---------------------------------------------------------------------------
# Form schema builder: task workflow (state field defaults / options)
# ---------------------------------------------------------------------------
FORM_SCHEMA_TASK_WORKFLOW_MANIFEST: dict[str, Any] = {
    "task_workflow_id": "tw",
    "defs": [
        {
            "kind": "Workflow",
            "id": "tw",
            "initial": "backlog",
            "states": ["backlog", "wip"],
            "transitions": [],
        },
    ],
}

# ---------------------------------------------------------------------------
# List schema (defs vs top-level flat, column overlays)
# ---------------------------------------------------------------------------
LIST_SCHEMA_EMPTY_DEFS_MANIFEST: dict[str, Any] = {"defs": []}

LIST_SCHEMA_FROM_DEFS_MANIFEST: dict[str, Any] = {
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

LIST_SCHEMA_TOP_LEVEL_MANIFEST: dict[str, Any] = {
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

LIST_SCHEMA_FLAT_CUSTOM_COLUMNS: dict[str, Any] = {
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

LIST_SCHEMA_FLAT_EMPTY_ARTIFACT_TYPES: dict[str, Any] = {
    "workflows": [{"id": "basic", "states": ["new"], "transitions": []}],
    "artifact_types": [],
}

LIST_SCHEMA_FLAT_REQUIREMENT_PRIORITY: dict[str, Any] = {
    "workflows": [{"id": "basic", "states": ["new", "active"], "transitions": []}],
    "artifact_types": [
        {
            "id": "requirement",
            "name": "Requirement",
            "workflow_id": "basic",
            "fields": [{"id": "priority", "name": "Priority", "type": "string"}],
        },
    ],
}

LIST_SCHEMA_ARTIFACT_LIST_TAGS_HIDDEN: dict[str, Any] = {
    "artifact_list": {
        "columns": [
            {"key": "title", "order": 1},
            {"key": "tags", "visible": False, "order": 2},
            {"key": "state", "order": 3},
        ]
    }
}

LIST_SCHEMA_ARTIFACT_LIST_COLUMN_OVERRIDE: dict[str, Any] = {
    "artifact_list": {
        "columns": [
            {"key": "title", "label": "Summary", "order": 1, "sortable": True},
            {"key": "state", "visible": True, "order": 2},
        ]
    }
}

LIST_SCHEMA_DEFECTS_SURFACE_OVERRIDE: dict[str, Any] = {
    "artifact_list": {
        "surfaces": {
            "defects": {
                "fixed_columns": ["title", "severity", "updated_at"],
                "exclude_columns": ["artifact_key", "artifact_type", "state", "tags", "created_at", "state_reason", "resolution"],
                "extra_column_limit": 2,
            }
        }
    }
}

LIST_SCHEMA_BACKLOG_SURFACE_OVERRIDE: dict[str, Any] = {
    "artifact_list": {
        "surfaces": {
            "backlog": {
                "fixed_columns": ["title", "state", "severity", "updated_at"],
            }
        }
    }
}

# ---------------------------------------------------------------------------
# manifest_workflow_metadata (task states, tree roots, resolution targets)
# ---------------------------------------------------------------------------
MANIFEST_WORKFLOW_METADATA_TREE_ROOTS_BUNDLE: dict[str, Any] = {
    "tree_roots": [
        {"tree_id": "req", "root_artifact_type": "root-requirement"},
        {"tree_id": "custom", "root_artifact_type": "root-custom"},
    ]
}

MANIFEST_WORKFLOW_METADATA_TASK_BUNDLE: dict[str, Any] = {
    "task_workflow_id": "tw",
    "defs": [
        {
            "kind": "Workflow",
            "id": "tw",
            "initial": "open",
            "states": ["open", "shipped"],
            "transitions": [{"from": "open", "to": "shipped", "on": "ship"}],
        },
    ],
}

MANIFEST_WORKFLOW_METADATA_RESOLUTION_EXPLICIT_BUNDLE: dict[str, Any] = {
    "workflows": [
        {
            "id": "w1",
            "states": ["a", "b"],
            "resolution_target_states": ["b"],
        }
    ]
}

MANIFEST_WORKFLOW_METADATA_RESOLUTION_CATEGORY_BUNDLE: dict[str, Any] = {
    "workflows": [
        {
            "id": "w1",
            "states": [
                {"id": "open", "category": "proposed"},
                {"id": "done", "category": "completed"},
            ],
        }
    ]
}

# ---------------------------------------------------------------------------
# Create project (seed roots from manifest bundle)
# ---------------------------------------------------------------------------
CREATE_PROJECT_ROOTS_MANIFEST_BUNDLE: dict[str, Any] = {
    "tree_roots": [
        {"tree_id": "requirement", "root_artifact_type": "root-requirement"},
        {"tree_id": "quality", "root_artifact_type": "root-quality"},
        {"tree_id": "testsuites", "root_artifact_type": "root-testsuites"},
        {"tree_id": "defect", "root_artifact_type": "root-defect"},
    ],
    "defs": [
        {"kind": "Workflow", "id": "root", "initial": "Active", "states": ["Active"], "transitions": []},
        {"kind": "ArtifactType", "id": "root-requirement", "workflow_id": "root", "child_types": []},
        {"kind": "ArtifactType", "id": "root-quality", "workflow_id": "root", "child_types": []},
        {"kind": "ArtifactType", "id": "root-testsuites", "workflow_id": "root", "child_types": []},
        {"kind": "ArtifactType", "id": "root-defect", "workflow_id": "root", "child_types": []},
    ],
}

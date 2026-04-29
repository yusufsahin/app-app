"""ALM tools exposed to the AI agent via tool calling."""

from __future__ import annotations

ALM_TOOLS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "list_artifacts",
            "description": "List artifacts in the project with optional filters",
            "parameters": {
                "type": "object",
                "properties": {
                    "state_filter": {"type": "string"},
                    "type_filter": {"type": "string"},
                    "limit": {"type": "integer", "default": 20},
                    "offset": {"type": "integer", "default": 0},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_artifact_detail",
            "description": "Get a single artifact detail by ID",
            "parameters": {
                "type": "object",
                "required": ["artifact_id"],
                "properties": {"artifact_id": {"type": "string"}},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_artifact",
            "description": "Create a new artifact in the project",
            "parameters": {
                "type": "object",
                "required": ["artifact_type", "title", "parent_id"],
                "properties": {
                    "artifact_type": {"type": "string"},
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "parent_id": {"type": "string"},
                    "assignee_id": {"type": "string"},
                    "cycle_id": {"type": "string"},
                    "area_node_id": {"type": "string"},
                    "team_id": {"type": "string"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_artifact",
            "description": "Update an existing artifact",
            "parameters": {
                "type": "object",
                "required": ["artifact_id"],
                "properties": {
                    "artifact_id": {"type": "string"},
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "assignee_id": {"type": "string"},
                    "cycle_id": {"type": "string"},
                    "area_node_id": {"type": "string"},
                    "team_id": {"type": "string"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "transition_artifact",
            "description": "Transition artifact state",
            "parameters": {
                "type": "object",
                "required": ["artifact_id", "target_state"],
                "properties": {
                    "artifact_id": {"type": "string"},
                    "target_state": {"type": "string"},
                    "reason": {"type": "string"},
                },
            },
        },
    },
]

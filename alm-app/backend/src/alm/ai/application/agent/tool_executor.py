"""Tool executor mapping agent tool names to existing mediator commands/queries."""

from __future__ import annotations

import uuid
from typing import Any

from alm.ai.application.dtos import AgentContext
from alm.artifact.application.commands.create_artifact import CreateArtifact
from alm.artifact.application.commands.transition_artifact import TransitionArtifact
from alm.artifact.application.commands.update_artifact import UpdateArtifact
from alm.artifact.application.queries.get_artifact import GetArtifact
from alm.artifact.application.queries.list_artifacts import ListArtifacts
from alm.shared.application.mediator import Mediator
from alm.shared.domain.exceptions import ValidationError


class ToolExecutor:
    def __init__(self, mediator: Mediator, context: AgentContext) -> None:
        self._mediator = mediator
        self._context = context

    async def execute(self, tool_name: str, args: dict[str, Any]) -> dict[str, Any]:
        match tool_name:
            case "list_artifacts":
                result = await self._mediator.query(
                    ListArtifacts(
                        tenant_id=self._context.tenant_id,
                        project_id=self._require_project_id(),
                        state_filter=args.get("state_filter"),
                        type_filter=args.get("type_filter"),
                        limit=args.get("limit"),
                        offset=args.get("offset"),
                    )
                )
                return {
                    "total": result.total,
                    "items": [
                        {
                            "id": str(i.id),
                            "artifact_key": i.artifact_key,
                            "title": i.title,
                            "state": i.state,
                            "artifact_type": i.artifact_type,
                        }
                        for i in result.items
                    ],
                }
            case "get_artifact_detail":
                artifact_id = _as_uuid(args.get("artifact_id"), "artifact_id")
                dto = await self._mediator.query(
                    GetArtifact(
                        tenant_id=self._context.tenant_id,
                        project_id=self._require_project_id(),
                        artifact_id=artifact_id,
                    )
                )
                if dto is None:
                    return {"found": False}
                return {
                    "found": True,
                    "artifact": {
                        "id": str(dto.id),
                        "artifact_key": dto.artifact_key,
                        "title": dto.title,
                        "description": dto.description,
                        "state": dto.state,
                        "artifact_type": dto.artifact_type,
                    },
                }
            case "create_artifact":
                dto = await self._mediator.send(
                    CreateArtifact(
                        tenant_id=self._context.tenant_id,
                        project_id=self._require_project_id(),
                        artifact_type=_as_str(args.get("artifact_type"), "artifact_type"),
                        title=_as_str(args.get("title"), "title"),
                        description=_as_optional_str(args.get("description")),
                        parent_id=_as_uuid(args.get("parent_id"), "parent_id"),
                        assignee_id=_as_optional_uuid(args.get("assignee_id")),
                        cycle_id=_as_optional_uuid(args.get("cycle_id")),
                        area_node_id=_as_optional_uuid(args.get("area_node_id")),
                        team_id=_as_optional_uuid(args.get("team_id")),
                        created_by=self._context.user_id,
                    )
                )
                return {"artifact_id": str(dto.id), "artifact_key": dto.artifact_key}
            case "update_artifact":
                dto = await self._mediator.send(
                    UpdateArtifact(
                        tenant_id=self._context.tenant_id,
                        project_id=self._require_project_id(),
                        artifact_id=_as_uuid(args.get("artifact_id"), "artifact_id"),
                        title=_as_optional_str(args.get("title")),
                        description=_as_optional_str(args.get("description")),
                        assignee_id=_as_optional_uuid(args.get("assignee_id")),
                        cycle_id=_as_optional_uuid(args.get("cycle_id")),
                        area_node_id=_as_optional_uuid(args.get("area_node_id")),
                        team_id=_as_optional_uuid(args.get("team_id")),
                        updated_by=self._context.user_id,
                    )
                )
                return {"artifact_id": str(dto.id), "state": dto.state}
            case "transition_artifact":
                dto = await self._mediator.send(
                    TransitionArtifact(
                        tenant_id=self._context.tenant_id,
                        project_id=self._require_project_id(),
                        artifact_id=_as_uuid(args.get("artifact_id"), "artifact_id"),
                        target_state=_as_str(args.get("target_state"), "target_state"),
                        reason=_as_optional_str(args.get("reason")),
                        changed_by=self._context.user_id,
                    )
                )
                return {"artifact_id": str(dto.id), "state": dto.state}
            case _:
                raise ValidationError(f"Unknown tool: {tool_name}")

    def _require_project_id(self) -> uuid.UUID:
        if self._context.project_id is None:
            raise ValidationError("project_id is required for artifact tools")
        return self._context.project_id


def _as_str(value: Any, name: str) -> str:
    if not isinstance(value, str) or value.strip() == "":
        raise ValidationError(f"{name} is required")
    return value.strip()


def _as_optional_str(value: Any) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValidationError("Invalid string value")
    stripped = value.strip()
    return stripped if stripped else None


def _as_uuid(value: Any, name: str) -> uuid.UUID:
    if not isinstance(value, str) or value.strip() == "":
        raise ValidationError(f"{name} is required")
    try:
        return uuid.UUID(value)
    except ValueError as exc:
        raise ValidationError(f"{name} must be a valid UUID") from exc


def _as_optional_uuid(value: Any) -> uuid.UUID | None:
    if value is None:
        return None
    return _as_uuid(value, "uuid")

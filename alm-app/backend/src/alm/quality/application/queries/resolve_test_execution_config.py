from __future__ import annotations

import json
import re
import uuid
from dataclasses import dataclass, field
from typing import Any

import structlog

from alm.artifact.domain.entities import Artifact
from alm.artifact.domain.ports import ArtifactRepository
from alm.artifact_link.domain.ports import ArtifactLinkRepository
from alm.project.domain.ports import ProjectRepository
from alm.quality.application.execution_linked_tests import linked_execution_test_ids_for_run
from alm.shared.application.query import Query, QueryHandler
from alm.shared.domain.exceptions import ValidationError

_PLACEHOLDER_RE = re.compile(r"\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}")
_VALID_STEP_STATUS = {"passed", "failed", "blocked", "not-executed"}
logger = structlog.get_logger()


@dataclass(frozen=True)
class ResolveTestExecutionConfig(Query):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    run_id: uuid.UUID
    test_id: uuid.UUID
    configuration_id: str | None = None


@dataclass
class ResolvedExecutionConfigurationOptionDTO:
    id: str
    name: str | None
    is_default: bool = False


@dataclass
class ResolvedExecutionStepDTO:
    id: str
    step_number: int
    name: str
    description: str
    expected_result: str
    status: str = "not-executed"


@dataclass
class ResolvedExecutionConfigDTO:
    test_id: uuid.UUID
    configuration_id: str | None
    configuration_name: str | None
    available_configurations: list[ResolvedExecutionConfigurationOptionDTO] = field(default_factory=list)
    resolved_values: dict[str, str] = field(default_factory=dict)
    unresolved_params: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    steps: list[ResolvedExecutionStepDTO] = field(default_factory=list)


@dataclass
class _ExpandedExecutionResult:
    steps: list[ResolvedExecutionStepDTO] = field(default_factory=list)
    effective_values: dict[str, str] = field(default_factory=dict)


def _as_object(raw: Any) -> dict[str, Any] | None:
    return raw if isinstance(raw, dict) else None


def _parse_json_like(raw: Any) -> Any:
    if isinstance(raw, str) and raw.strip():
        try:
            return json.loads(raw)
        except (TypeError, ValueError):
            return None
    return raw


def _parse_test_params(raw: Any) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    doc = _parse_json_like(raw)
    if not isinstance(doc, dict):
        return [], []
    defs = [item for item in doc.get("defs", []) if isinstance(item, dict)]
    rows = [item for item in doc.get("rows", []) if isinstance(item, dict)]
    return defs, rows


def _default_values(defs: list[dict[str, Any]]) -> dict[str, str]:
    out: dict[str, str] = {}
    for item in defs:
        name = str(item.get("name") or "").strip()
        if not name:
            continue
        if item.get("default") is not None:
            out[name] = str(item.get("default") or "")
    return out


def _configuration_options(rows: list[dict[str, Any]]) -> list[ResolvedExecutionConfigurationOptionDTO]:
    out: list[ResolvedExecutionConfigurationOptionDTO] = []
    for row in rows:
        row_id = str(row.get("id") or "").strip()
        if not row_id:
            continue
        row_name = str(row.get("name") or row.get("label") or "").strip() or None
        out.append(
            ResolvedExecutionConfigurationOptionDTO(
                id=row_id,
                name=row_name,
                is_default=bool(row.get("isDefault", False)),
            )
        )
    return out


def _pick_configuration_row(rows: list[dict[str, Any]], configuration_id: str | None) -> dict[str, Any] | None:
    if not rows:
        return None
    if configuration_id:
        row = next((item for item in rows if str(item.get("id") or "").strip() == configuration_id), None)
        if row is None:
            raise ValidationError("configuration_id does not exist on this test case")
        return row
    row = next((item for item in rows if bool(item.get("isDefault", False))), None)
    return row or rows[0]


def _build_root_values(defs: list[dict[str, Any]], row: dict[str, Any] | None) -> dict[str, str]:
    values = _default_values(defs)
    row_values = row.get("values") if isinstance(row, dict) else None
    if isinstance(row_values, dict):
        for key, value in row_values.items():
            values[str(key)] = "" if value is None else str(value)
    return values


def _parse_plan_entries(raw: Any) -> list[dict[str, Any]]:
    items = _parse_json_like(raw)
    if not isinstance(items, list):
        return []
    out: list[dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        kind = str(item.get("kind") or "").strip()
        if kind == "call":
            called_id = str(item.get("calledTestCaseId") or "").strip()
            if not called_id:
                continue
            overrides_raw = item.get("paramOverrides")
            overrides: dict[str, str] = {}
            if isinstance(overrides_raw, dict):
                overrides = {
                    str(key): "" if value is None else str(value)
                    for key, value in overrides_raw.items()
                }
            out.append(
                {
                    "kind": "call",
                    "id": str(item.get("id") or f"call-{len(out) + 1}"),
                    "calledTestCaseId": called_id,
                    "paramOverrides": overrides,
                }
            )
            continue
        if kind != "step":
            continue
        name = str(item.get("name") or "").strip()
        if not name:
            continue
        status = str(item.get("status") or "not-executed").strip()
        out.append(
            {
                "kind": "step",
                "id": str(item.get("id") or f"step-{len(out) + 1}"),
                "name": name,
                "description": str(item.get("description") or ""),
                "expectedResult": str(item.get("expectedResult") or ""),
                "status": status if status in _VALID_STEP_STATUS else "not-executed",
            }
        )
    return out


def _apply_values(template: str, values: dict[str, str]) -> str:
    return _PLACEHOLDER_RE.sub(
        lambda match: values.get(match.group(1), match.group(0)),
        template,
    )


def _collect_unresolved(steps: list[ResolvedExecutionStepDTO]) -> list[str]:
    unresolved: set[str] = set()
    for step in steps:
        for text in (step.name, step.description, step.expected_result):
            for match in _PLACEHOLDER_RE.finditer(text):
                unresolved.add(match.group(1))
    return sorted(unresolved)


class ResolveTestExecutionConfigHandler(QueryHandler[ResolvedExecutionConfigDTO]):
    def __init__(
        self,
        project_repo: ProjectRepository,
        artifact_repo: ArtifactRepository,
        link_repo: ArtifactLinkRepository,
    ) -> None:
        self._project_repo = project_repo
        self._artifact_repo = artifact_repo
        self._link_repo = link_repo

    async def handle(self, query: Query) -> ResolvedExecutionConfigDTO:
        assert isinstance(query, ResolveTestExecutionConfig)
        project = await self._project_repo.find_by_id(query.project_id)
        if project is None or project.tenant_id != query.tenant_id:
            raise ValidationError("Project not found")

        artifacts = await self._artifact_repo.list_by_ids_in_project(
            query.project_id, [query.run_id, query.test_id]
        )
        artifact_by_id = {artifact.id: artifact for artifact in artifacts}
        run = artifact_by_id.get(query.run_id)
        test = artifact_by_id.get(query.test_id)
        if run is None or run.artifact_type != "test-run":
            raise ValidationError("run_id must be a test-run in this project")
        if test is None or test.artifact_type != "test-case":
            raise ValidationError("test_id must be a test-case in this project")

        run_links = await self._link_repo.list_outgoing_links_from_artifacts(query.project_id, [query.run_id])
        suite_ids = [link.to_artifact_id for link in run_links if link.link_type == "run_for_suite"]
        suite_links = (
            await self._link_repo.list_suite_includes_tests_for_suites(query.project_id, suite_ids)
            if suite_ids
            else []
        )
        suite_outgoing_by_suite_id: dict[uuid.UUID, list[Any]] = {}
        for link in suite_links:
            suite_outgoing_by_suite_id.setdefault(link.from_artifact_id, []).append(link)
        allowed_test_ids = linked_execution_test_ids_for_run(run_links, suite_outgoing_by_suite_id)
        if allowed_test_ids and query.test_id not in allowed_test_ids:
            raise ValidationError("test_id is not linked to this run")

        defs, rows = _parse_test_params(test.custom_fields.get("test_params_json") if test.custom_fields else None)
        config_row = _pick_configuration_row(rows, query.configuration_id)
        root_values = _build_root_values(defs, config_row)
        available_configurations = _configuration_options(rows)

        expanded = await self._expand_steps(
            project_id=query.project_id,
            root_test=test,
            inherited_values=root_values,
            visited={query.test_id},
        )
        unresolved_params = _collect_unresolved(expanded.steps)
        if unresolved_params:
            logger.info(
                "quality_execution_resolution_unresolved_params",
                project_id=str(query.project_id),
                run_id=str(query.run_id),
                test_id=str(query.test_id),
                configuration_id=str(config_row.get("id")) if isinstance(config_row, dict) and config_row.get("id") else None,
                unresolved_params=unresolved_params,
            )
        configuration_name = None
        if config_row is not None:
            configuration_name = str(config_row.get("name") or config_row.get("label") or "").strip() or None

        return ResolvedExecutionConfigDTO(
            test_id=query.test_id,
            configuration_id=str(config_row.get("id")).strip() if isinstance(config_row, dict) and config_row.get("id") else None,
            configuration_name=configuration_name,
            available_configurations=available_configurations,
            resolved_values=expanded.effective_values,
            unresolved_params=unresolved_params,
            warnings=[],
            steps=expanded.steps,
        )

    async def _expand_steps(
        self,
        *,
        project_id: uuid.UUID,
        root_test: Artifact,
        inherited_values: dict[str, str],
        visited: set[uuid.UUID],
    ) -> _ExpandedExecutionResult:
        raw_steps = root_test.custom_fields.get("test_steps_json") if root_test.custom_fields else None
        entries = _parse_plan_entries(raw_steps)
        out: list[ResolvedExecutionStepDTO] = []
        effective_values = dict(inherited_values)
        for entry in entries:
            if entry.get("kind") == "step":
                out.append(
                    ResolvedExecutionStepDTO(
                        id=str(entry["id"]),
                        step_number=len(out) + 1,
                        name=_apply_values(str(entry.get("name") or ""), inherited_values),
                        description=_apply_values(str(entry.get("description") or ""), inherited_values),
                        expected_result=_apply_values(str(entry.get("expectedResult") or ""), inherited_values),
                        status=str(entry.get("status") or "not-executed"),
                    )
                )
                continue

            called_test_id = uuid.UUID(str(entry.get("calledTestCaseId")))
            if called_test_id in visited:
                raise ValidationError("Circular test call detected")
            called_test = await self._artifact_repo.find_by_id(called_test_id)
            if called_test is None or called_test.project_id != project_id:
                raise ValidationError("Called test case could not be loaded")
            callee_defs, _ = _parse_test_params(
                called_test.custom_fields.get("test_params_json") if called_test.custom_fields else None
            )
            override_values = entry.get("paramOverrides") if isinstance(entry.get("paramOverrides"), dict) else {}
            callee_names = {str(item.get("name") or "").strip() for item in callee_defs}
            invalid_keys = [key for key in override_values if key not in callee_names]
            if invalid_keys:
                raise ValidationError(f"Unknown override key(s): {', '.join(sorted(invalid_keys))}")
            child_values = {
                **_default_values(callee_defs),
                **inherited_values,
                **{str(key): str(value) for key, value in override_values.items()},
            }
            child_expanded = await self._expand_steps(
                project_id=project_id,
                root_test=called_test,
                inherited_values=child_values,
                visited={*visited, called_test_id},
            )
            effective_values.update(child_expanded.effective_values)
            for child in child_expanded.steps:
                out.append(
                    ResolvedExecutionStepDTO(
                        id=f"call:{entry['id']}:{child.id}",
                        step_number=len(out) + 1,
                        name=child.name,
                        description=child.description,
                        expected_result=child.expected_result,
                        status=child.status,
                    )
                )
        return _ExpandedExecutionResult(steps=out, effective_values=effective_values)

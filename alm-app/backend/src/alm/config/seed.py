from __future__ import annotations

import json
import uuid
from pathlib import Path
from typing import Any

import structlog
import yaml  # type: ignore[import-untyped]
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from alm.artifact.domain.entities import Artifact as ArtifactEntity
from alm.artifact.domain.manifest_workflow_metadata import get_tree_root_type_map
from alm.artifact.domain.mpc_resolver import get_manifest_ast
from alm.artifact.domain.ports import ArtifactRepository
from alm.artifact.domain.quality_manifest_extension import with_quality_manifest_bundle
from alm.artifact.domain.workflow_sm import get_initial_state as workflow_get_initial_state
from alm.artifact.infrastructure.repositories import SqlAlchemyArtifactRepository
from alm.artifact_link.domain.entities import ArtifactLink
from alm.artifact_link.infrastructure.repositories import SqlAlchemyArtifactLinkRepository
from alm.auth.domain.entities import User
from alm.auth.infrastructure.repositories import SqlAlchemyUserRepository
from alm.config.settings import settings
from alm.process_template.infrastructure.repositories import (
    SqlAlchemyProcessTemplateRepository,
)
from alm.project.domain.entities import Project
from alm.project.infrastructure.repositories import SqlAlchemyProjectRepository
from alm.project_tag.infrastructure.repositories import SqlAlchemyProjectTagRepository
from alm.shared.domain.value_objects import ProjectCode, Slug
from alm.shared.infrastructure.security.password import hash_password
from alm.task.domain.entities import Task as TaskEntity
from alm.task.infrastructure.repositories import SqlAlchemyTaskRepository
from alm.tenant.application.sagas.tenant_onboarding import TenantOnboardingSaga
from alm.tenant.domain.entities import Privilege
from alm.tenant.infrastructure.models import TenantModel
from alm.tenant.infrastructure.repositories import (
    SqlAlchemyMembershipRepository,
    SqlAlchemyPrivilegeRepository,
    SqlAlchemyRoleRepository,
    SqlAlchemyTenantRepository,
)

logger = structlog.get_logger()

# Optional manifest roots (metadata-driven UI / API); task workflow for linked tasks.
_MANIFEST_TASK_AND_TREES: dict[str, Any] = {
    "task_workflow_id": "task_basic",
    "tree_roots": [
        {"tree_id": "requirement", "root_artifact_type": "root-requirement"},
        {"tree_id": "quality", "root_artifact_type": "root-quality"},
        {"tree_id": "testsuites", "root_artifact_type": "root-testsuites"},
        {"tree_id": "defect", "root_artifact_type": "root-defect"},
    ],
}

def _open_text_defect_parity_fields(*, visible_in: list[str]) -> list[dict[str, Any]]:
    """Custom fields aligned with OpenText-style defect triage (manifest `typeName` → `artifact_type` in forms)."""
    vw = {"field": "typeName", "in": visible_in}
    return [
        {
            "id": "severity",
            "name": "Severity",
            "type": "choice",
            "options": [
                {"id": "low", "label": "Low"},
                {"id": "medium", "label": "Medium"},
                {"id": "high", "label": "High"},
                {"id": "critical", "label": "Critical"},
            ],
            "visibleWhen": vw,
        },
        {
            "id": "defect_priority",
            "name": "Priority",
            "type": "choice",
            "options": [
                {"id": "1", "label": "1"},
                {"id": "2", "label": "2"},
                {"id": "3", "label": "3"},
                {"id": "4", "label": "4"},
                {"id": "5", "label": "5"},
            ],
            "visibleWhen": vw,
        },
        {
            "id": "detected_by",
            "name": "Detected by",
            "type": "entity_ref",
            "entity_ref": "user",
            "visibleWhen": vw,
        },
        {
            "id": "detected_on_date",
            "name": "Detected on",
            "type": "date",
            "visibleWhen": vw,
        },
        {
            "id": "reproducible",
            "name": "Reproducible",
            "type": "choice",
            "options": [
                {"id": "yes", "label": "Yes"},
                {"id": "no", "label": "No"},
                {"id": "unknown", "label": "Unknown"},
            ],
            "visibleWhen": vw,
        },
        {
            "id": "detected_version",
            "name": "Detected in version",
            "type": "string",
            "visibleWhen": vw,
        },
        {
            "id": "planned_fix_version",
            "name": "Planned fix version",
            "type": "string",
            "visibleWhen": vw,
        },
        {
            "id": "closed_version",
            "name": "Closed version",
            "type": "string",
            "visibleWhen": vw,
        },
        {
            "id": "closing_date",
            "name": "Closing date",
            "type": "date",
            "visibleWhen": vw,
        },
        {
            "id": "detected_environment",
            "name": "Detected environment",
            "type": "string",
            "visibleWhen": vw,
        },
        {
            "id": "detected_in_release",
            "name": "Detected in release / cycle",
            "type": "string",
            "visibleWhen": vw,
        },
        {
            "id": "target_release",
            "name": "Target release / cycle",
            "type": "string",
            "visibleWhen": vw,
        },
        {
            "id": "estimated_fix_days",
            "name": "Estimated fix time (days)",
            "type": "number",
            "visibleWhen": vw,
        },
        {
            "id": "actual_fix_days",
            "name": "Actual fix time (days)",
            "type": "number",
            "visibleWhen": vw,
        },
    ]


_TASK_BASIC_WORKFLOW_DEF: dict[str, Any] = {
    "kind": "Workflow",
    "id": "task_basic",
    "initial": "todo",
    "states": ["todo", "in_progress", "done"],
    "transitions": [
        {"from": "todo", "to": "in_progress", "on": "start"},
        {"from": "in_progress", "to": "done", "on": "complete"},
        {"from": "done", "to": "in_progress", "on": "reopen"},
    ],
}

# Demo seed credentials (change in production)
DEMO_EMAIL = "admin@example.com"
DEMO_PASSWORD = "Admin123!"
DEMO_DISPLAY_NAME = "Admin User"
DEMO_ORG_NAME = "Demo"  # slug: demo
DEMO_PROJECTS = [
    {
        "name": "Sample Project",
        "code": "SAMP",
        "description": "Primary demo: multi-feature backlog, parameterized tests, tags, tasks, defects, quality trees",
    },
    {
        "name": "Unima",
        "code": "UNIMA",
        "description": "Secondary demo project with a small seeded epic, requirement, and defect",
    },
]


def _seed_step(
    step_id: str,
    step_number: int,
    name: str,
    expected_result: str,
    *,
    description: str = "",
    status: str = "not-executed",
) -> dict[str, Any]:
    return {
        "kind": "step",
        "id": step_id,
        "stepNumber": step_number,
        "name": name,
        "description": description,
        "expectedResult": expected_result,
        "status": status,
    }


def _seed_call_step(
    step_id: str,
    step_number: int,
    called_test_case_id: uuid.UUID,
    called_title: str,
    *,
    param_overrides: dict[str, Any] | None = None,
) -> dict[str, Any]:
    row: dict[str, Any] = {
        "kind": "call",
        "id": step_id,
        "stepNumber": step_number,
        "calledTestCaseId": str(called_test_case_id),
        "calledTitle": called_title,
    }
    if param_overrides:
        row["paramOverrides"] = {str(k): "" if v is None else str(v) for k, v in param_overrides.items()}
    return row


def _seed_configuration(
    config_id: str,
    name: str,
    label: str,
    values: dict[str, Any],
    *,
    is_default: bool = False,
    status: str = "active",
    tags: list[str] | None = None,
) -> dict[str, Any]:
    row: dict[str, Any] = {
        "id": config_id,
        "name": name,
        "label": label,
        "status": status,
        "values": {str(k): "" if v is None else str(v) for k, v in values.items()},
    }
    if is_default:
        row["isDefault"] = True
    if tags:
        row["tags"] = tags
    return row


def _seed_test_params(defs: list[dict[str, Any]], rows: list[dict[str, Any]] | None = None) -> str:
    payload: dict[str, Any] = {"v": 2, "defs": defs}
    if rows:
        payload["rows"] = rows
    return json.dumps(payload)


def _seed_test_steps(steps: list[dict[str, Any]]) -> str:
    return json.dumps(steps)


def _seed_run_result(
    test_id: uuid.UUID,
    status: str,
    *,
    configuration_id: str | None = None,
    configuration_name: str | None = None,
    configuration_snapshot: dict[str, Any] | None = None,
    resolved_values: dict[str, Any] | None = None,
    step_results: list[dict[str, Any]] | None = None,
    expanded_steps_snapshot: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    row: dict[str, Any] = {
        "testId": str(test_id),
        "status": status,
        "stepResults": step_results or [],
    }
    if configuration_id is not None:
        row["configurationId"] = configuration_id
    if configuration_name is not None:
        row["configurationName"] = configuration_name
    if configuration_snapshot is not None:
        row["configurationSnapshot"] = configuration_snapshot
    if resolved_values is not None:
        row["resolvedValues"] = {str(k): "" if v is None else str(v) for k, v in resolved_values.items()}
        row["paramValuesUsed"] = row["resolvedValues"]
    if expanded_steps_snapshot is not None:
        row["expandedStepsSnapshot"] = expanded_steps_snapshot
    return row


def _seed_run_metrics(results: list[dict[str, Any]]) -> str:
    return json.dumps({"v": 2, "results": results})


def _find_seed_dir() -> Path:
    """Locate alm_meta/seed: cwd (Docker /app) or next to alm package."""
    for base in (Path.cwd(), Path(__file__).resolve().parents[3]):
        candidate = base / "alm_meta" / "seed"
        if (candidate / "default_privileges.yaml").exists():
            return candidate
    return Path.cwd() / "alm_meta" / "seed"  # fallback


async def seed_privileges(session_factory: async_sessionmaker[AsyncSession]) -> None:
    yaml_path = _find_seed_dir() / "default_privileges.yaml"
    if not yaml_path.exists():
        logger.error("seed_file_not_found", path=str(yaml_path))
        raise RuntimeError(
            f"Seed file not found: {yaml_path}. "
            "Ensure alm_meta/seed/default_privileges.yaml exists (e.g. run from backend dir or set cwd)."
        )

    try:
        with yaml_path.open() as f:
            data = yaml.safe_load(f)

        definitions: list[dict[str, Any]] = data.get("privileges", [])
        if not definitions:
            logger.info("seed_no_privileges_defined")
            return

        async with session_factory() as session:
            repo = SqlAlchemyPrivilegeRepository(session)
            to_insert: list[Privilege] = []

            for entry in definitions:
                existing = await repo.find_by_code(entry["code"])
                if existing is None:
                    to_insert.append(
                        Privilege(
                            code=entry["code"],
                            resource=entry["resource"],
                            action=entry["action"],
                            description=entry.get("description", ""),
                        )
                    )

            if to_insert:
                await repo.add_many(to_insert)
                await session.commit()
                logger.info("privileges_seeded", count=len(to_insert))
            else:
                logger.info("privileges_already_up_to_date")
    except Exception as e:
        logger.exception("seed_privileges_failed", error=str(e))
        raise


async def seed_process_templates(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    """Seed built-in process templates (Basic) if empty."""
    from sqlalchemy import select

    from alm.process_template.infrastructure.models import (
        ProcessTemplateModel,
        ProcessTemplateVersionModel,
    )

    try:
        async with session_factory() as session:
            result = await session.execute(select(ProcessTemplateModel).limit(1))
            if result.scalar_one_or_none() is not None:
                logger.info("process_templates_already_seeded")
                return

            basic = ProcessTemplateModel(
                slug="basic",
                name="Basic",
                is_builtin=True,
                description="Simple workflow for requirements and defects",
                type="basic",
            )
            session.add(basic)
            await session.flush()

            version = ProcessTemplateVersionModel(
                template_id=basic.id,
                version="1.0.0",
                manifest_bundle=with_quality_manifest_bundle(
                    {
                        "schemaVersion": 1,
                        "namespace": "alm",
                        "name": "basic",
                        "manifestVersion": "1.0.0",
                        **_MANIFEST_TASK_AND_TREES,
                        "defs": [
                            {
                                "kind": "Workflow",
                                "id": "root",
                                "initial": "Active",
                                "states": ["Active"],
                                "transitions": [],
                            },
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
                                "state_reason_options": [
                                    {"id": "", "label": "— None —"},
                                    {"id": "new_defect_reported", "label": "New defect reported"},
                                    {"id": "build_failure", "label": "Build failure"},
                                    {"id": "work_started", "label": "Work started"},
                                    {"id": "code_complete", "label": "Code complete"},
                                    {"id": "work_finished", "label": "Work finished"},
                                    {"id": "accepted", "label": "Accepted"},
                                    {"id": "deferred", "label": "Deferred"},
                                ],
                                "resolution_options": [
                                    {"id": "", "label": "— None —"},
                                    {"id": "fixed", "label": "Fixed"},
                                    {"id": "fixed_and_verified", "label": "Fixed and verified"},
                                    {"id": "wont_fix", "label": "Won't fix"},
                                    {"id": "duplicate", "label": "Duplicate"},
                                    {"id": "as_designed", "label": "As designed"},
                                    {"id": "not_a_bug", "label": "Not a bug"},
                                ],
                                "resolution_target_states": ["resolved", "closed"],
                            },
                            _TASK_BASIC_WORKFLOW_DEF,
                            {
                                "kind": "ArtifactType",
                                "id": "root-requirement",
                                "name": "Project root (Requirements)",
                                "workflow_id": "root",
                                "child_types": ["epic"],
                                "fields": [],
                            },
                            {
                                "kind": "ArtifactType",
                                "id": "root-quality",
                                "name": "Project root (Quality)",
                                "workflow_id": "root",
                                "child_types": ["test-case"],
                                "fields": [],
                            },
                            {
                                "kind": "ArtifactType",
                                "id": "root-defect",
                                "name": "Project root (Defects)",
                                "workflow_id": "root",
                                "child_types": ["defect"],
                                "fields": [],
                            },
                            {
                                "kind": "ArtifactType",
                                "id": "test-case",
                                "name": "Test case",
                                "workflow_id": "basic",
                                "parent_types": ["root-quality"],
                                "child_types": [],
                                "fields": [
                                    {"id": "priority", "name": "Priority", "type": "string"},
                                    {
                                        "id": "automation",
                                        "name": "Automation",
                                        "type": "choice",
                                        "options": [
                                            {"id": "manual", "label": "Manual"},
                                            {"id": "automated", "label": "Automated"},
                                        ],
                                    },
                                ],
                            },
                            {
                                "kind": "ArtifactType",
                                "id": "epic",
                                "workflow_id": "basic",
                                "parent_types": ["root-requirement"],
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
                                "id": "requirement",
                                "workflow_id": "basic",
                                "parent_types": ["feature", "epic"],
                                "fields": [{"id": "priority", "name": "Priority", "type": "string"}],
                            },
                            {
                                "kind": "ArtifactType",
                                "id": "defect",
                                "workflow_id": "basic",
                                "parent_types": ["root-defect"],
                                "fields": _open_text_defect_parity_fields(visible_in=["defect"]),
                            },
                            {
                                "kind": "TransitionPolicy",
                                "id": "assignee_active",
                                "when": {"state": "active"},
                                "require": "assignee",
                            },
                            {"kind": "LinkType", "id": "related", "name": "Related"},
                            {"kind": "LinkType", "id": "verifies", "name": "Verifies"},
                            {"kind": "LinkType", "id": "tests", "name": "Tests"},
                            {"kind": "LinkType", "id": "blocks", "name": "Blocks"},
                        ],
                    }
                ),
            )
            session.add(version)

            # Scrum template
            scrum = ProcessTemplateModel(
                slug="scrum",
                name="Scrum",
                is_builtin=True,
                description="Agile framework with sprints and user stories",
                type="scrum",
            )
            session.add(scrum)
            await session.flush()

            scrum_version = ProcessTemplateVersionModel(
                template_id=scrum.id,
                version="1.0.0",
                manifest_bundle=with_quality_manifest_bundle(
                    {
                        "schemaVersion": 1,
                        "namespace": "alm",
                        "name": "scrum",
                        "manifestVersion": "1.0.0",
                        **_MANIFEST_TASK_AND_TREES,
                        "defs": [
                            {
                                "kind": "Workflow",
                                "id": "root",
                                "initial": "Active",
                                "states": ["Active"],
                                "transitions": [],
                            },
                            {
                                "kind": "Workflow",
                                "id": "scrum",
                                "initial": "new",
                                "finals": ["done"],
                                "states": ["new", "approved", "in_progress", "in_review", "done"],
                                "transitions": [
                                    {"from": "new", "to": "approved", "on": "approve"},
                                    {"from": "approved", "to": "in_progress", "on": "start"},
                                    {"from": "in_progress", "to": "in_review", "on": "submit"},
                                    {"from": "in_review", "to": "done", "on": "complete"},
                                    {"from": "in_review", "to": "in_progress", "on": "rework"},
                                    {"from": "done", "to": "in_progress", "on": "reopen"},
                                ],
                                "state_reason_options": [
                                    {"id": "", "label": "— None —"},
                                    {"id": "new_backlog_item", "label": "New backlog item"},
                                    {"id": "approved", "label": "Approved by Product Owner"},
                                    {"id": "commitment_made", "label": "Commitment made by the team"},
                                    {"id": "work_stopped", "label": "Work stopped"},
                                    {"id": "work_finished", "label": "Work finished"},
                                ],
                                "resolution_options": [
                                    {"id": "", "label": "— None —"},
                                    {"id": "fixed", "label": "Fixed"},
                                    {"id": "fixed_and_verified", "label": "Fixed and verified"},
                                    {"id": "wont_fix", "label": "Won't fix"},
                                    {"id": "duplicate", "label": "Duplicate"},
                                    {"id": "as_designed", "label": "As designed"},
                                    {"id": "not_a_bug", "label": "Not a bug"},
                                ],
                                "resolution_target_states": ["done"],
                            },
                            _TASK_BASIC_WORKFLOW_DEF,
                            {
                                "kind": "ArtifactType",
                                "id": "root-requirement",
                                "name": "Project root (Requirements)",
                                "workflow_id": "root",
                                "child_types": ["epic"],
                                "fields": [],
                            },
                            {
                                "kind": "ArtifactType",
                                "id": "root-quality",
                                "name": "Project root (Quality)",
                                "workflow_id": "root",
                                "child_types": ["test-case"],
                                "fields": [],
                            },
                            {
                                "kind": "ArtifactType",
                                "id": "root-defect",
                                "name": "Project root (Defects)",
                                "workflow_id": "root",
                                "child_types": ["defect"],
                                "fields": [],
                            },
                            {
                                "kind": "ArtifactType",
                                "id": "test-case",
                                "name": "Test case",
                                "workflow_id": "scrum",
                                "parent_types": ["root-quality"],
                                "child_types": [],
                                "fields": [
                                    {"id": "story_points", "name": "Story Points", "type": "number"},
                                    {"id": "acceptance_criteria", "name": "Acceptance Criteria", "type": "string"},
                                ],
                            },
                            {
                                "kind": "ArtifactType",
                                "id": "epic",
                                "workflow_id": "scrum",
                                "parent_types": ["root-requirement"],
                                "child_types": ["feature"],
                                "fields": [{"id": "priority", "name": "Priority", "type": "string"}],
                            },
                            {
                                "kind": "ArtifactType",
                                "id": "feature",
                                "workflow_id": "scrum",
                                "parent_types": ["epic"],
                                "child_types": ["user_story"],
                                "fields": [{"id": "story_points", "name": "Story Points", "type": "number"}],
                            },
                            {
                                "kind": "ArtifactType",
                                "id": "user_story",
                                "workflow_id": "scrum",
                                "parent_types": ["feature"],
                                "fields": [
                                    {
                                        "id": "story_points",
                                        "name": "Story Points",
                                        "type": "number",
                                        "requiredWhen": {"field": "typeName", "eq": "user_story"},
                                    },
                                    {"id": "acceptance_criteria", "name": "Acceptance Criteria", "type": "string"},
                                ],
                            },
                            {
                                "kind": "ArtifactType",
                                "id": "defect",
                                "workflow_id": "scrum",
                                "parent_types": ["root-defect"],
                                "fields": _open_text_defect_parity_fields(visible_in=["defect"]),
                            },
                            {
                                "kind": "TransitionPolicy",
                                "id": "assignee_in_progress",
                                "when": {"state": "in_progress"},
                                "require": "assignee",
                            },
                            {"kind": "LinkType", "id": "related", "name": "Related"},
                            {"kind": "LinkType", "id": "verifies", "name": "Verifies"},
                            {"kind": "LinkType", "id": "tests", "name": "Tests"},
                            {"kind": "LinkType", "id": "blocks", "name": "Blocks"},
                        ],
                    }
                ),
            )
            session.add(scrum_version)

            # Kanban template
            kanban = ProcessTemplateModel(
                slug="kanban",
                name="Kanban",
                is_builtin=True,
                description="Flow-based work management",
                type="kanban",
            )
            session.add(kanban)
            await session.flush()

            kanban_version = ProcessTemplateVersionModel(
                template_id=kanban.id,
                version="1.0.0",
                manifest_bundle=with_quality_manifest_bundle(
                    {
                        "schemaVersion": 1,
                        "namespace": "alm",
                        "name": "kanban",
                        "manifestVersion": "1.0.0",
                        **_MANIFEST_TASK_AND_TREES,
                        "defs": [
                            {
                                "kind": "Workflow",
                                "id": "root",
                                "initial": "Active",
                                "states": ["Active"],
                                "transitions": [],
                            },
                            {
                                "kind": "Workflow",
                                "id": "kanban",
                                "initial": "backlog",
                                "finals": ["done"],
                                "states": ["backlog", "ready", "in_progress", "done"],
                                "transitions": [
                                    {"from": "backlog", "to": "ready", "on": "prepare"},
                                    {"from": "ready", "to": "in_progress", "on": "start"},
                                    {"from": "in_progress", "to": "done", "on": "complete"},
                                    {"from": "done", "to": "in_progress", "on": "reopen"},
                                ],
                                "state_reason_options": [
                                    {"id": "", "label": "— None —"},
                                    {"id": "new_item", "label": "New item"},
                                    {"id": "ready_for_work", "label": "Ready for work"},
                                    {"id": "work_started", "label": "Work started"},
                                    {"id": "work_finished", "label": "Work finished"},
                                ],
                                "resolution_options": [
                                    {"id": "", "label": "— None —"},
                                    {"id": "fixed", "label": "Fixed"},
                                    {"id": "fixed_and_verified", "label": "Fixed and verified"},
                                    {"id": "wont_fix", "label": "Won't fix"},
                                    {"id": "duplicate", "label": "Duplicate"},
                                    {"id": "as_designed", "label": "As designed"},
                                ],
                                "resolution_target_states": ["done"],
                            },
                            _TASK_BASIC_WORKFLOW_DEF,
                            {
                                "kind": "ArtifactType",
                                "id": "root-requirement",
                                "name": "Project root (Requirements)",
                                "workflow_id": "root",
                                "child_types": ["epic"],
                                "fields": [],
                            },
                            {
                                "kind": "ArtifactType",
                                "id": "root-quality",
                                "name": "Project root (Quality)",
                                "workflow_id": "root",
                                "child_types": ["test-case"],
                                "fields": [],
                            },
                            {
                                "kind": "ArtifactType",
                                "id": "root-defect",
                                "name": "Project root (Defects)",
                                "workflow_id": "root",
                                "child_types": ["defect"],
                                "fields": [],
                            },
                            {
                                "kind": "ArtifactType",
                                "id": "test-case",
                                "name": "Test case",
                                "workflow_id": "kanban",
                                "parent_types": ["root-quality"],
                                "child_types": [],
                                "fields": [{"id": "priority", "name": "Priority", "type": "string"}],
                            },
                            {
                                "kind": "ArtifactType",
                                "id": "epic",
                                "workflow_id": "kanban",
                                "parent_types": ["root-requirement"],
                                "child_types": ["feature"],
                                "fields": [{"id": "priority", "name": "Priority", "type": "string"}],
                            },
                            {
                                "kind": "ArtifactType",
                                "id": "feature",
                                "workflow_id": "kanban",
                                "parent_types": ["epic"],
                                "child_types": ["task"],
                                "fields": [{"id": "story_points", "name": "Story Points", "type": "number"}],
                            },
                            {
                                "kind": "ArtifactType",
                                "id": "task",
                                "workflow_id": "kanban",
                                "parent_types": ["feature"],
                                "fields": [{"id": "priority", "name": "Priority", "type": "string"}],
                            },
                            {
                                "kind": "ArtifactType",
                                "id": "defect",
                                "workflow_id": "kanban",
                                "parent_types": ["root-defect"],
                                "fields": _open_text_defect_parity_fields(visible_in=["defect"]),
                            },
                            {
                                "kind": "TransitionPolicy",
                                "id": "assignee_in_progress",
                                "when": {"state": "in_progress"},
                                "require": "assignee",
                            },
                            {"kind": "LinkType", "id": "related", "name": "Related"},
                            {"kind": "LinkType", "id": "verifies", "name": "Verifies"},
                            {"kind": "LinkType", "id": "tests", "name": "Tests"},
                            {"kind": "LinkType", "id": "blocks", "name": "Blocks"},
                        ],
                    }
                ),
            )
            session.add(kanban_version)

            # Azure DevOps Basic (Epic, Issue only; Task is a separate entity in ALM)
            ado_basic = ProcessTemplateModel(
                slug="azure_devops_basic",
                name="Azure DevOps Basic",
                is_builtin=True,
                description="Epic, Issue — aligned with Azure DevOps Basic (Task is separate entity)",
                type="basic",
            )
            session.add(ado_basic)
            await session.flush()

            ado_basic_version = ProcessTemplateVersionModel(
                template_id=ado_basic.id,
                version="1.0.0",
                manifest_bundle=with_quality_manifest_bundle(
                    {
                        "schemaVersion": 1,
                        "namespace": "alm",
                        "name": "azure_devops_basic",
                        "manifestVersion": "1.0.0",
                        **_MANIFEST_TASK_AND_TREES,
                        "defs": [
                            {
                                "kind": "Workflow",
                                "id": "root",
                                "initial": "Active",
                                "states": ["Active"],
                                "transitions": [],
                            },
                            {
                                "kind": "Workflow",
                                "id": "ado_basic",
                                "initial": "new",
                                "finals": ["closed"],
                                "states": ["new", "active", "resolved", "closed"],
                                "transitions": [
                                    {
                                        "from": "new",
                                        "to": "active",
                                        "trigger": "start",
                                        "trigger_label": "Start",
                                        "guard": "assignee_required",
                                    },
                                    {
                                        "from": "active",
                                        "to": "resolved",
                                        "trigger": "resolve",
                                        "trigger_label": "Resolve",
                                    },
                                    {"from": "resolved", "to": "closed", "trigger": "close", "trigger_label": "Close"},
                                    {"from": "closed", "to": "active", "trigger": "reopen", "trigger_label": "Reopen"},
                                ],
                                "state_reason_options": [
                                    {"id": "", "label": "— None —"},
                                    {"id": "new_item", "label": "New item"},
                                    {"id": "work_started", "label": "Work started"},
                                    {"id": "work_finished", "label": "Work finished"},
                                    {"id": "deferred", "label": "Deferred"},
                                ],
                                "resolution_options": [
                                    {"id": "", "label": "— None —"},
                                    {"id": "fixed", "label": "Fixed"},
                                    {"id": "wont_fix", "label": "Won't fix"},
                                    {"id": "duplicate", "label": "Duplicate"},
                                    {"id": "as_designed", "label": "As designed"},
                                ],
                                "resolution_target_states": ["resolved", "closed"],
                            },
                            _TASK_BASIC_WORKFLOW_DEF,
                            {
                                "kind": "ArtifactType",
                                "id": "root-requirement",
                                "name": "Project root (Requirements)",
                                "workflow_id": "root",
                                "child_types": ["epic"],
                                "fields": [],
                            },
                            {
                                "kind": "ArtifactType",
                                "id": "root-quality",
                                "name": "Project root (Quality)",
                                "workflow_id": "root",
                                "child_types": ["test-case"],
                                "fields": [],
                            },
                            {
                                "kind": "ArtifactType",
                                "id": "root-defect",
                                "name": "Project root (Defects)",
                                "workflow_id": "root",
                                "child_types": ["defect"],
                                "fields": [],
                            },
                            {
                                "kind": "ArtifactType",
                                "id": "defect",
                                "name": "Defect",
                                "workflow_id": "ado_basic",
                                "parent_types": ["root-defect"],
                                "child_types": [],
                                "fields": _open_text_defect_parity_fields(visible_in=["defect"]),
                            },
                            {
                                "kind": "ArtifactType",
                                "id": "test-case",
                                "name": "Test case",
                                "workflow_id": "ado_basic",
                                "parent_types": ["root-quality"],
                                "child_types": [],
                                "fields": [
                                    {
                                        "id": "priority",
                                        "name": "Priority",
                                        "type": "choice",
                                        "options": [
                                            {"id": "1", "label": "1 - Critical"},
                                            {"id": "2", "label": "2 - High"},
                                            {"id": "3", "label": "3 - Medium"},
                                            {"id": "4", "label": "4 - Low"},
                                        ],
                                    },
                                ],
                            },
                            {
                                "kind": "ArtifactType",
                                "id": "epic",
                                "name": "Epic",
                                "workflow_id": "ado_basic",
                                "parent_types": ["root-requirement"],
                                "child_types": ["issue"],
                                "fields": [
                                    {
                                        "id": "priority",
                                        "name": "Priority",
                                        "type": "choice",
                                        "options": [
                                            {"id": "1", "label": "1 - Critical"},
                                            {"id": "2", "label": "2 - High"},
                                            {"id": "3", "label": "3 - Medium"},
                                            {"id": "4", "label": "4 - Low"},
                                        ],
                                    },
                                    {"id": "business_value", "name": "Business Value", "type": "number"},
                                    {"id": "target_date", "name": "Target Date", "type": "date"},
                                ],
                            },
                            {
                                "kind": "ArtifactType",
                                "id": "issue",
                                "name": "Issue",
                                "workflow_id": "ado_basic",
                                "parent_types": ["epic"],
                                "child_types": [],
                                "fields": [
                                    {
                                        "id": "priority",
                                        "name": "Priority",
                                        "type": "choice",
                                        "options": [
                                            {"id": "1", "label": "1 - Critical"},
                                            {"id": "2", "label": "2 - High"},
                                            {"id": "3", "label": "3 - Medium"},
                                            {"id": "4", "label": "4 - Low"},
                                        ],
                                    },
                                    {
                                        "id": "severity",
                                        "name": "Severity",
                                        "type": "choice",
                                        "options": [
                                            {"id": "low", "label": "Low"},
                                            {"id": "medium", "label": "Medium"},
                                            {"id": "high", "label": "High"},
                                            {"id": "critical", "label": "Critical"},
                                        ],
                                    },
                                    {"id": "story_points", "name": "Story Points", "type": "number"},
                                    {"id": "acceptance_criteria", "name": "Acceptance Criteria", "type": "string"},
                                    {"id": "repro_steps", "name": "Repro Steps", "type": "string"},
                                ],
                            },
                            {"kind": "LinkType", "id": "hierarchy", "name": "Hierarchy"},
                            {"kind": "LinkType", "id": "related", "name": "Related"},
                            {"kind": "LinkType", "id": "blocks", "name": "Blocks"},
                            {"kind": "LinkType", "id": "verifies", "name": "Verifies"},
                            {"kind": "LinkType", "id": "tests", "name": "Tests"},
                            {
                                "kind": "TransitionPolicy",
                                "id": "assignee_required_on_active",
                                "when": {"state": "active"},
                                "require": "assignee",
                            },
                        ],
                    }
                ),
            )
            session.add(ado_basic_version)

            await session.commit()
            logger.info(
                "process_templates_seeded",
                templates=["basic", "scrum", "kanban", "azure_devops_basic"],
            )
    except Exception as e:
        logger.exception("seed_process_templates_failed", error=str(e))
        raise


async def _create_project_roots_in_seed(
    artifact_repo: ArtifactRepository,
    project: Project,
    manifest_bundle: dict[str, Any],
    version_id: uuid.UUID,
) -> None:
    """Create project roots from manifest tree_roots (used in seed only)."""
    ast = get_manifest_ast(version_id, manifest_bundle)
    root_type_map = get_tree_root_type_map(manifest_bundle)
    root_types = list(dict.fromkeys(root_type_map.values()))
    key_suffix_map = {
        "root-requirement": "R0",
        "root-testsuites": "TS0",
        "root-defect": "D0",
        "root-quality": "Q0",
    }
    for root_type in root_types:
        state = workflow_get_initial_state(manifest_bundle, root_type, ast=ast)
        if state is None:
            continue
        suffix = key_suffix_map.get(root_type, f"{root_type.upper()}0")
        root = ArtifactEntity.create(
            project_id=project.id,
            artifact_type=root_type,
            title=project.name,
            state=state,
            parent_id=None,
            artifact_key=f"{project.code}-{suffix}",
        )
        await artifact_repo.add(root)


async def seed_demo_data(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    """Create demo tenant, admin user, and sample projects when DB is empty."""
    if not settings.seed_demo_data:
        return

    async with session_factory() as session:
        result = await session.execute(select(TenantModel).limit(1))
        if result.scalar_one_or_none() is not None:
            logger.info("demo_data_skipped", reason="tenants_already_exist")
            return

    async with session_factory() as session:
        privilege_repo = SqlAlchemyPrivilegeRepository(session)
        all_privileges = await privilege_repo.find_all()
        if not all_privileges:
            logger.warning(
                "demo_data_skipped",
                reason="no_privileges_seeded",
                message="Run seed_privileges first (ensure alm_meta/seed/default_privileges.yaml exists).",
            )
            return

    logger.info("seeding_demo_data")

    try:
        async with session_factory() as session:
            user_repo = SqlAlchemyUserRepository(session)
            tenant_repo = SqlAlchemyTenantRepository(session)
            role_repo = SqlAlchemyRoleRepository(session)
            membership_repo = SqlAlchemyMembershipRepository(session)
            project_repo = SqlAlchemyProjectRepository(session)
            process_template_repo = SqlAlchemyProcessTemplateRepository(session)

            existing_user = await user_repo.find_by_email(DEMO_EMAIL)
            if existing_user is not None:
                logger.info("demo_data_skipped", reason="admin_user_already_exists")
                return

            password_hash = hash_password(DEMO_PASSWORD)
            user = User.create(
                email=DEMO_EMAIL,
                display_name=DEMO_DISPLAY_NAME,
                password_hash=password_hash,
            )
            await user_repo.add(user)

            onboarding = TenantOnboardingSaga(
                tenant_repo=tenant_repo,
                role_repo=role_repo,
                privilege_repo=SqlAlchemyPrivilegeRepository(session),
                membership_repo=membership_repo,
            )
            provisioned = await onboarding.provision_tenant(DEMO_ORG_NAME, user.id)

            default_version = await process_template_repo.find_default_version()
            version_id = default_version.id if default_version else None
            artifact_repo = SqlAlchemyArtifactRepository(session)
            first_project_id: uuid.UUID | None = None

            for proj in DEMO_PROJECTS:
                try:
                    code = ProjectCode.from_string(proj["code"])
                    slug = Slug.from_string(proj["name"])
                except ValueError:
                    continue
                project = Project.create(
                    tenant_id=provisioned.tenant_id,
                    name=proj["name"],
                    slug=slug.value,
                    code=code.value,
                    description=proj.get("description", ""),
                )
                if version_id:
                    project.process_template_version_id = version_id
                project.created_by = user.id
                await project_repo.add(project)
                if first_project_id is None:
                    first_project_id = project.id
                if version_id and default_version and default_version.manifest_bundle:
                    await _create_project_roots_in_seed(
                        artifact_repo, project, default_version.manifest_bundle, default_version.id
                    )

            first_project = await project_repo.list_by_tenant(provisioned.tenant_id)
            if first_project and version_id and default_version:
                demo_defect_high: ArtifactEntity | None = None
                demo_defect_medium: ArtifactEntity | None = None
                demo_defect_resolved: ArtifactEntity | None = None
                req_mfa: ArtifactEntity | None = None
                req_audit: ArtifactEntity | None = None
                demo_feature_o11y: ArtifactEntity | None = None

                mb = default_version.manifest_bundle or {}
                ast_seed = get_manifest_ast(default_version.id, mb)

                root_req_list = await artifact_repo.list_by_project(
                    first_project[0].id, type_filter="root-requirement"
                )
                root_req_id = root_req_list[0].id if root_req_list else None
                req_parent_id = root_req_id
                demo_epic: ArtifactEntity | None = None
                demo_feature: ArtifactEntity | None = None

                if root_req_id:
                    st_epic = workflow_get_initial_state(mb, "epic", ast=ast_seed) or "new"
                    seq_e = await project_repo.increment_artifact_seq(first_project[0].id)
                    demo_epic = ArtifactEntity(
                        project_id=first_project[0].id,
                        artifact_type="epic",
                        title="Demo — Platform delivery",
                        description="Seeded epic; requirements sit under a feature (manifest-valid hierarchy).",
                        state=st_epic,
                        parent_id=root_req_id,
                        artifact_key=f"{first_project[0].code}-{seq_e}",
                        custom_fields={"priority": "2"},
                    )
                    demo_epic.created_by = user.id
                    await artifact_repo.add(demo_epic)

                    st_feat = workflow_get_initial_state(mb, "feature", ast=ast_seed) or "new"
                    seq_f = await project_repo.increment_artifact_seq(first_project[0].id)
                    demo_feature = ArtifactEntity(
                        project_id=first_project[0].id,
                        artifact_type="feature",
                        title="Authentication & session management",
                        description="Feature bucket for login, tokens, and session lifecycle requirements.",
                        state=st_feat,
                        parent_id=demo_epic.id,
                        artifact_key=f"{first_project[0].code}-{seq_f}",
                        custom_fields={"story_points": 8},
                    )
                    demo_feature.created_by = user.id
                    await artifact_repo.add(demo_feature)
                    req_parent_id = demo_feature.id

                    st_o11y = workflow_get_initial_state(mb, "feature", ast=ast_seed) or "new"
                    seq_o = await project_repo.increment_artifact_seq(first_project[0].id)
                    demo_feature_o11y = ArtifactEntity(
                        project_id=first_project[0].id,
                        artifact_type="feature",
                        title="Observability & compliance",
                        description="Audit trails, metrics export, and retention policies for regulated workloads.",
                        state=st_o11y,
                        parent_id=demo_epic.id,
                        artifact_key=f"{first_project[0].code}-{seq_o}",
                        custom_fields={"story_points": 5},
                    )
                    demo_feature_o11y.created_by = user.id
                    await artifact_repo.add(demo_feature_o11y)

                st_req = workflow_get_initial_state(mb, "requirement", ast=ast_seed) or "new"
                seq = await project_repo.increment_artifact_seq(first_project[0].id)
                sample = ArtifactEntity(
                    project_id=first_project[0].id,
                    artifact_type="requirement",
                    title="Sample requirement",
                    description="Traced by seeded test cases; parent is a feature per Basic template rules.",
                    state=st_req,
                    parent_id=req_parent_id,
                    artifact_key=f"{first_project[0].code}-{seq}",
                    custom_fields={"governance_artifact_id": "schema.cycle.v1", "priority": "high"},
                )
                sample.created_by = user.id
                await artifact_repo.add(sample)

                seq_manifest = await project_repo.increment_artifact_seq(first_project[0].id)
                gov_manifest = ArtifactEntity(
                    project_id=first_project[0].id,
                    artifact_type="requirement",
                    title="Governance anchor: manifest sample (demo)",
                    description="Maps to artifact_catalog manifest_sample.cycle.minimal for traceability export",
                    state=st_req,
                    parent_id=req_parent_id,
                    artifact_key=f"{first_project[0].code}-{seq_manifest}",
                    custom_fields={"governance_artifact_id": "manifest_sample.cycle.minimal"},
                )
                gov_manifest.created_by = user.id
                await artifact_repo.add(gov_manifest)

                seq_rule = await project_repo.increment_artifact_seq(first_project[0].id)
                gov_rule = ArtifactEntity(
                    project_id=first_project[0].id,
                    artifact_type="requirement",
                    title="Governance anchor: rule pack (demo)",
                    description="Maps to artifact_catalog rule_pack.cycle.v1 for traceability export",
                    state=st_req,
                    parent_id=req_parent_id,
                    artifact_key=f"{first_project[0].code}-{seq_rule}",
                    custom_fields={"governance_artifact_id": "rule_pack.cycle.v1"},
                )
                gov_rule.created_by = user.id
                await artifact_repo.add(gov_rule)

                if demo_feature is not None:
                    seq_mfa = await project_repo.increment_artifact_seq(first_project[0].id)
                    req_mfa = ArtifactEntity(
                        project_id=first_project[0].id,
                        artifact_type="requirement",
                        title="MFA enrollment is mandatory for privileged roles",
                        description=(
                            "Administrators and support roles must enroll TOTP before production access."
                        ),
                        state=st_req,
                        parent_id=demo_feature.id,
                        artifact_key=f"{first_project[0].code}-{seq_mfa}",
                        custom_fields={"priority": "high", "governance_artifact_id": "schema.cycle.v1"},
                    )
                    req_mfa.created_by = user.id
                    await artifact_repo.add(req_mfa)

                if demo_feature_o11y is not None:
                    seq_audit = await project_repo.increment_artifact_seq(first_project[0].id)
                    req_audit = ArtifactEntity(
                        project_id=first_project[0].id,
                        artifact_type="requirement",
                        title="Structured audit stream for security-sensitive API calls",
                        description=(
                            "AuthN, authZ, and data-export endpoints emit immutable audit events."
                        ),
                        state=st_req,
                        parent_id=demo_feature_o11y.id,
                        artifact_key=f"{first_project[0].code}-{seq_audit}",
                        custom_fields={"priority": "medium"},
                    )
                    req_audit.created_by = user.id
                    await artifact_repo.add(req_audit)

                root_defect_list = await artifact_repo.list_by_project(
                    first_project[0].id, type_filter="root-defect"
                )
                root_defect_id = root_defect_list[0].id if root_defect_list else None
                if root_defect_id:
                    st_def = workflow_get_initial_state(mb, "defect", ast=ast_seed) or "new"
                    seq_d1 = await project_repo.increment_artifact_seq(first_project[0].id)
                    demo_defect_high = ArtifactEntity(
                        project_id=first_project[0].id,
                        artifact_type="defect",
                        title="Session cookie persists after logout",
                        description="Seeded defect with OpenText-style fields for triage UI demos.",
                        state=st_def,
                        parent_id=root_defect_id,
                        assignee_id=user.id,
                        artifact_key=f"{first_project[0].code}-{seq_d1}",
                        custom_fields={
                            "severity": "high",
                            "defect_priority": "2",
                            "reproducible": "yes",
                            "detected_environment": "staging",
                            "detected_by": str(user.id),
                            "detected_version": "2.4.0",
                        },
                    )
                    demo_defect_high.created_by = user.id
                    await artifact_repo.add(demo_defect_high)

                    seq_d2 = await project_repo.increment_artifact_seq(first_project[0].id)
                    demo_defect_medium = ArtifactEntity(
                        project_id=first_project[0].id,
                        artifact_type="defect",
                        title="Search API latency spikes above 2s under concurrent load",
                        description="Performance regression observed in load tests; environment integration.",
                        state="active",
                        parent_id=root_defect_id,
                        artifact_key=f"{first_project[0].code}-{seq_d2}",
                        custom_fields={
                            "severity": "medium",
                            "defect_priority": "3",
                            "reproducible": "unknown",
                            "detected_environment": "integration",
                            "estimated_fix_days": 3,
                        },
                    )
                    demo_defect_medium.created_by = user.id
                    await artifact_repo.add(demo_defect_medium)

                    seq_d3 = await project_repo.increment_artifact_seq(first_project[0].id)
                    demo_defect_resolved = ArtifactEntity(
                        project_id=first_project[0].id,
                        artifact_type="defect",
                        title="Password reset email shows wrong product name",
                        description="Closed-loop example: fixed copy in template v3.",
                        state="resolved",
                        parent_id=root_defect_id,
                        artifact_key=f"{first_project[0].code}-{seq_d3}",
                        resolution="fixed",
                        custom_fields={
                            "severity": "low",
                            "defect_priority": "4",
                            "reproducible": "yes",
                            "detected_environment": "production",
                            "planned_fix_version": "2.5.0",
                        },
                    )
                    demo_defect_resolved.created_by = user.id
                    await artifact_repo.add(demo_defect_resolved)

                root_quality_list = await artifact_repo.list_by_project(first_project[0].id, type_filter="root-quality")
                parent_tests_id = root_quality_list[0].id if root_quality_list else None
                root_suites_list = await artifact_repo.list_by_project(
                    first_project[0].id,
                    type_filter="root-testsuites",
                )
                parent_suites_id = root_suites_list[0].id if root_suites_list else None
                tc_state = "new"
                if default_version and default_version.manifest_bundle and parent_tests_id:
                    ast_tc = get_manifest_ast(default_version.id, default_version.manifest_bundle)
                    tc_state = (
                        workflow_get_initial_state(default_version.manifest_bundle, "test-case", ast=ast_tc) or "new"
                    )

                tests_folder = None
                suites_folder = None
                tc_login = None
                tc_api = None
                tc_security = None
                tc_composite = None
                perf_folder = None
                api_subfolder = None
                extra_test_cases: list[ArtifactEntity] = []
                demo_suite = None
                api_suite = None
                scale_suite = None
                demo_run = None
                previous_demo_run = None
                failed_run = None
                scale_run = None
                demo_campaign = None
                release_campaign = None
                if parent_tests_id and parent_suites_id:
                    seq_qf = await project_repo.increment_artifact_seq(first_project[0].id)
                    tests_folder = ArtifactEntity(
                        project_id=first_project[0].id,
                        artifact_type="quality-folder",
                        title="Sprint 24 - Tests",
                        description="Seeded test folder to demonstrate test-case hierarchy.",
                        state="Active",
                        parent_id=parent_tests_id,
                        artifact_key=f"{first_project[0].code}-{seq_qf}",
                        custom_fields={},
                    )
                    tests_folder.created_by = user.id
                    await artifact_repo.add(tests_folder)
                    seq_sf = await project_repo.increment_artifact_seq(first_project[0].id)
                    suites_folder = ArtifactEntity(
                        project_id=first_project[0].id,
                        artifact_type="testsuite-folder",
                        title="Sprint 24 — Collections",
                        description="Seeded campaign collection (testsuite-folder) for suite/run/campaign hierarchy.",
                        state="Active",
                        parent_id=parent_suites_id,
                        artifact_key=f"{first_project[0].code}-{seq_sf}",
                        custom_fields={},
                    )
                    suites_folder.created_by = user.id
                    await artifact_repo.add(suites_folder)

                    seq_pf = await project_repo.increment_artifact_seq(first_project[0].id)
                    perf_folder = ArtifactEntity(
                        project_id=first_project[0].id,
                        artifact_type="quality-folder",
                        title="Performance",
                        description="Seeded nested folder for scale/performance test-cases.",
                        state="Active",
                        parent_id=tests_folder.id,
                        artifact_key=f"{first_project[0].code}-{seq_pf}",
                        custom_fields={},
                    )
                    perf_folder.created_by = user.id
                    await artifact_repo.add(perf_folder)

                    seq_af = await project_repo.increment_artifact_seq(first_project[0].id)
                    api_subfolder = ArtifactEntity(
                        project_id=first_project[0].id,
                        artifact_type="quality-folder",
                        title="API Contracts",
                        description="Seeded nested folder under Performance.",
                        state="Active",
                        parent_id=perf_folder.id,
                        artifact_key=f"{first_project[0].code}-{seq_af}",
                        custom_fields={},
                    )
                    api_subfolder.created_by = user.id
                    await artifact_repo.add(api_subfolder)

                    seq_tc1 = await project_repo.increment_artifact_seq(first_project[0].id)
                    tc_login = ArtifactEntity(
                        project_id=first_project[0].id,
                        artifact_type="test-case",
                        title="Login — happy path",
                        description="Parameterized manual case (${env}, ${username}); reused by composite E2E.",
                        state=tc_state,
                        parent_id=tests_folder.id if tests_folder is not None else parent_tests_id,
                        artifact_key=f"{first_project[0].code}-{seq_tc1}",
                        custom_fields={
                            "priority": "high",
                            "automation": "manual",
                            "test_params_json": _seed_test_params(
                                defs=[
                                    {"name": "env", "label": "Environment", "default": "staging", "type": "string"},
                                    {"name": "username", "label": "Username", "default": "demo.user", "type": "string"},
                                ],
                                rows=[
                                    _seed_configuration(
                                        "cfg-login-staging",
                                        "staging_qa",
                                        "Staging QA",
                                        {"env": "staging", "username": "qa.alpha"},
                                        is_default=True,
                                        tags=["smoke", "staging"],
                                    ),
                                    _seed_configuration(
                                        "cfg-login-prod",
                                        "prod_smoke",
                                        "Prod smoke",
                                        {"env": "production", "username": "smoke.bot"},
                                        tags=["prod", "release-gate"],
                                    ),
                                    _seed_configuration(
                                        "cfg-login-qa-eu",
                                        "qa_eu_regression",
                                        "QA EU Regression",
                                        {"env": "qa-eu", "username": "qa.eu.runner"},
                                        tags=["qa", "eu", "regression"],
                                    ),
                                ],
                            ),
                            "test_steps_json": _seed_test_steps(
                                [
                                    _seed_step(
                                        "step-1",
                                        1,
                                        "Open login page",
                                        "Login form is visible for the selected environment",
                                        description="Target ${env}; account ${username}.",
                                    ),
                                    _seed_step(
                                        "step-2",
                                        2,
                                        "Submit valid credentials",
                                        "Redirect to dashboard",
                                        description="Use ${username} with a valid password from the vault.",
                                    ),
                                ]
                            ),
                        },
                    )
                    tc_login.created_by = user.id
                    await artifact_repo.add(tc_login)

                    seq_tc2 = await project_repo.increment_artifact_seq(first_project[0].id)
                    tc_api = ArtifactEntity(
                        project_id=first_project[0].id,
                        artifact_type="test-case",
                        title="API — error response contract",
                        description="Second demo row for Quality list and traceability views.",
                        state=tc_state,
                        parent_id=tests_folder.id if tests_folder is not None else parent_tests_id,
                        artifact_key=f"{first_project[0].code}-{seq_tc2}",
                        custom_fields={
                            "priority": "medium",
                            "automation": "automated",
                            "test_steps_json": _seed_test_steps(
                                [
                                    _seed_step(
                                        "step-1",
                                        1,
                                        "Send invalid payload",
                                        "HTTP 400 with schema errors",
                                    ),
                                ]
                            ),
                        },
                    )
                    tc_api.created_by = user.id
                    await artifact_repo.add(tc_api)

                    seq_tc3 = await project_repo.increment_artifact_seq(first_project[0].id)
                    tc_security = ArtifactEntity(
                        project_id=first_project[0].id,
                        artifact_type="test-case",
                        title="Rate limit - brute force protection",
                        description="Validate lockout / throttling behavior after repeated failed login attempts.",
                        state=tc_state,
                        parent_id=tests_folder.id if tests_folder is not None else parent_tests_id,
                        artifact_key=f"{first_project[0].code}-{seq_tc3}",
                        custom_fields={
                            "priority": "critical",
                            "automation": "manual",
                            "test_steps_json": _seed_test_steps(
                                [
                                    _seed_step(
                                        "step-1",
                                        1,
                                        "Send 10 invalid login attempts",
                                        "Rate limit message is shown",
                                    ),
                                ]
                            ),
                        },
                    )
                    tc_security.created_by = user.id
                    await artifact_repo.add(tc_security)

                    seq_tc_comp = await project_repo.increment_artifact_seq(first_project[0].id)
                    tc_composite = ArtifactEntity(
                        project_id=first_project[0].id,
                        artifact_type="test-case",
                        title="E2E — session flow delegates to login happy path",
                        description="Composite plan: local pre-step then Call-to-Test into the login case.",
                        state=tc_state,
                        parent_id=tests_folder.id if tests_folder is not None else parent_tests_id,
                        artifact_key=f"{first_project[0].code}-{seq_tc_comp}",
                        custom_fields={
                            "priority": "medium",
                            "automation": "manual",
                            "test_steps_json": _seed_test_steps(
                                [
                                    _seed_step(
                                        "pre-1",
                                        1,
                                        "Clear browser storage for clean session",
                                        "No prior session cookies for the app origin",
                                    ),
                                    _seed_call_step(
                                        "call-login",
                                        2,
                                        tc_login.id,
                                        tc_login.title,
                                        param_overrides={"env": "staging", "username": "qa.alpha"},
                                    ),
                                ]
                            ),
                        },
                    )
                    tc_composite.created_by = user.id
                    await artifact_repo.add(tc_composite)

                    extra_case_specs = [
                        ("API — list users pagination", "Validate pagination metadata and bounds handling."),
                        ("API — unauthorized access", "Validate 401 response for missing auth token."),
                        ("API — invalid enum value", "Validate validation payload for invalid enum values."),
                        ("Load — 100 concurrent logins", "Validate median response latency under baseline load."),
                        ("Load — burst traffic 500 rps", "Validate throttling and degradation behavior."),
                        ("Security — SQL injection attempt", "Validate malicious payload sanitization."),
                        ("Security — XSS payload rejection", "Validate script payload output encoding."),
                        ("Resilience — transient DB outage", "Validate retry/fallback and graceful recovery."),
                    ]
                    for idx, (title, desc) in enumerate(extra_case_specs, start=1):
                        seq_extra = await project_repo.increment_artifact_seq(first_project[0].id)
                        extra_case = ArtifactEntity(
                            project_id=first_project[0].id,
                            artifact_type="test-case",
                            title=title,
                            description=desc,
                            state=tc_state,
                            parent_id=api_subfolder.id if idx <= 3 else perf_folder.id,
                            artifact_key=f"{first_project[0].code}-{seq_extra}",
                            custom_fields={
                                "priority": "high" if idx <= 3 else "medium",
                                "automation": "automated" if idx % 2 == 0 else "manual",
                                "test_steps_json": _seed_test_steps(
                                    [
                                        _seed_step(
                                            "step-1",
                                            1,
                                            "Execute test scenario",
                                            "Expected system behavior is observed",
                                        ),
                                    ]
                                ),
                            },
                        )
                        extra_case.created_by = user.id
                        await artifact_repo.add(extra_case)
                        extra_test_cases.append(extra_case)

                    if default_version and default_version.manifest_bundle:
                        ast_q = get_manifest_ast(default_version.id, default_version.manifest_bundle)
                        mb = default_version.manifest_bundle
                        suite_st = workflow_get_initial_state(mb, "test-suite", ast=ast_q) or tc_state
                        run_st = workflow_get_initial_state(mb, "test-run", ast=ast_q) or "not_started"
                        camp_st = workflow_get_initial_state(mb, "test-campaign", ast=ast_q) or "not_started"
                        seq_su = await project_repo.increment_artifact_seq(first_project[0].id)
                        demo_suite = ArtifactEntity(
                            project_id=first_project[0].id,
                            artifact_type="test-suite",
                            title="Demo regression suite",
                            description="Sample test suite (manifest test-suite); includes Login test via link.",
                            state=suite_st,
                            parent_id=suites_folder.id if suites_folder is not None else parent_suites_id,
                            artifact_key=f"{first_project[0].code}-{seq_su}",
                            custom_fields={"suite_note": "Seed demo"},
                        )
                        demo_suite.created_by = user.id
                        await artifact_repo.add(demo_suite)

                        seq_su2 = await project_repo.increment_artifact_seq(first_project[0].id)
                        api_suite = ArtifactEntity(
                            project_id=first_project[0].id,
                            artifact_type="test-suite",
                            title="API contract suite",
                            description="Covers API validation and security contract checks.",
                            state=suite_st,
                            parent_id=suites_folder.id if suites_folder is not None else parent_suites_id,
                            artifact_key=f"{first_project[0].code}-{seq_su2}",
                            custom_fields={"suite_note": "API + security"},
                        )
                        api_suite.created_by = user.id
                        await artifact_repo.add(api_suite)

                        seq_su3 = await project_repo.increment_artifact_seq(first_project[0].id)
                        scale_suite = ArtifactEntity(
                            project_id=first_project[0].id,
                            artifact_type="test-suite",
                            title="Scale and resilience suite",
                            description="High-volume suite seeded for link modal stress scenarios.",
                            state=suite_st,
                            parent_id=suites_folder.id if suites_folder is not None else parent_suites_id,
                            artifact_key=f"{first_project[0].code}-{seq_su3}",
                            custom_fields={"suite_note": "Scale coverage"},
                        )
                        scale_suite.created_by = user.id
                        await artifact_repo.add(scale_suite)

                        seq_run = await project_repo.increment_artifact_seq(first_project[0].id)
                        demo_run = ArtifactEntity(
                            project_id=first_project[0].id,
                            artifact_type="test-run",
                            title="Demo test run",
                            description="Run metrics reference real seeded test-case ids (login + API contract).",
                            state=run_st,
                            parent_id=suites_folder.id if suites_folder is not None else parent_suites_id,
                            artifact_key=f"{first_project[0].code}-{seq_run}",
                            custom_fields={
                                "environment": "staging",
                                "run_metrics_json": _seed_run_metrics(
                                    [
                                        _seed_run_result(
                                            tc_login.id,
                                            "passed",
                                            configuration_id="cfg-login-staging",
                                            configuration_name="Staging QA",
                                            configuration_snapshot=_seed_configuration(
                                                "cfg-login-staging",
                                                "staging_qa",
                                                "Staging QA",
                                                {"env": "staging", "username": "qa.alpha"},
                                                is_default=True,
                                                tags=["smoke", "staging"],
                                            ),
                                            resolved_values={"env": "staging", "username": "qa.alpha"},
                                            step_results=[
                                                {"stepId": "step-1", "status": "passed"},
                                                {"stepId": "step-2", "status": "passed"},
                                            ],
                                            expanded_steps_snapshot=[
                                                _seed_step(
                                                    "step-1",
                                                    1,
                                                    "Open login page",
                                                    "Login form is visible for the selected environment",
                                                    description="Target staging; account qa.alpha.",
                                                    status="passed",
                                                ),
                                                _seed_step(
                                                    "step-2",
                                                    2,
                                                    "Submit valid credentials",
                                                    "Redirect to dashboard",
                                                    description="Use qa.alpha with a valid password from the vault.",
                                                    status="passed",
                                                ),
                                            ],
                                        ),
                                        _seed_run_result(
                                            tc_api.id,
                                            "passed",
                                            resolved_values={},
                                            step_results=[
                                                {"stepId": "step-1", "status": "passed"},
                                            ],
                                            expanded_steps_snapshot=[
                                                _seed_step(
                                                    "step-1",
                                                    1,
                                                    "Send invalid payload",
                                                    "HTTP 400 with schema errors",
                                                    status="passed",
                                                ),
                                            ],
                                        ),
                                    ]
                                ),
                            },
                        )
                        demo_run.created_by = user.id
                        await artifact_repo.add(demo_run)

                        seq_run0 = await project_repo.increment_artifact_seq(first_project[0].id)
                        previous_demo_run = ArtifactEntity(
                            project_id=first_project[0].id,
                            artifact_type="test-run",
                            title="Demo test run - previous baseline",
                            description="Older regression baseline used to demonstrate compare-with-previous UI.",
                            state="completed",
                            parent_id=suites_folder.id if suites_folder is not None else parent_suites_id,
                            artifact_key=f"{first_project[0].code}-{seq_run0}",
                            custom_fields={
                                "environment": "staging",
                                "run_metrics_json": _seed_run_metrics(
                                    [
                                        _seed_run_result(
                                            tc_login.id,
                                            "failed",
                                            configuration_id="cfg-login-staging",
                                            configuration_name="Staging QA",
                                            configuration_snapshot=_seed_configuration(
                                                "cfg-login-staging",
                                                "staging_qa",
                                                "Staging QA",
                                                {"env": "staging", "username": "qa.alpha"},
                                                is_default=True,
                                                tags=["smoke", "staging"],
                                            ),
                                            resolved_values={"env": "staging", "username": "qa.alpha"},
                                            step_results=[
                                                {"stepId": "step-1", "status": "passed"},
                                                {"stepId": "step-2", "status": "failed"},
                                            ],
                                            expanded_steps_snapshot=[
                                                _seed_step(
                                                    "step-1",
                                                    1,
                                                    "Open login page",
                                                    "Login form is visible for the selected environment",
                                                    description="Target staging; account qa.alpha.",
                                                    status="passed",
                                                ),
                                                _seed_step(
                                                    "step-2",
                                                    2,
                                                    "Submit valid credentials",
                                                    "Redirect to dashboard",
                                                    description="Use qa.alpha with a valid password from the vault.",
                                                    status="failed",
                                                ),
                                            ],
                                        ),
                                        _seed_run_result(
                                            tc_api.id,
                                            "blocked",
                                            resolved_values={},
                                            step_results=[{"stepId": "step-1", "status": "blocked"}],
                                            expanded_steps_snapshot=[
                                                _seed_step(
                                                    "step-1",
                                                    1,
                                                    "Send invalid payload",
                                                    "HTTP 400 with schema errors",
                                                    status="blocked",
                                                ),
                                            ],
                                        ),
                                    ]
                                ),
                            },
                        )
                        previous_demo_run.created_by = user.id
                        await artifact_repo.add(previous_demo_run)

                        seq_run2 = await project_repo.increment_artifact_seq(first_project[0].id)
                        blocked_tid = (
                            str(extra_test_cases[0].id)
                            if extra_test_cases
                            else str(tc_login.id)
                        )
                        failed_run = ArtifactEntity(
                            project_id=first_project[0].id,
                            artifact_type="test-run",
                            title="Nightly API run - failed",
                            description="Mixed outcomes mapped to real test ids: pass / fail / blocked.",
                            state="failed",
                            parent_id=suites_folder.id if suites_folder is not None else parent_suites_id,
                            artifact_key=f"{first_project[0].code}-{seq_run2}",
                            custom_fields={
                                "environment": "staging",
                                "run_metrics_json": _seed_run_metrics(
                                    [
                                        _seed_run_result(
                                            tc_api.id,
                                            "passed",
                                            resolved_values={},
                                            step_results=[{"stepId": "step-1", "status": "passed"}],
                                        ),
                                        _seed_run_result(
                                            tc_security.id,
                                            "failed",
                                            resolved_values={},
                                            step_results=[{"stepId": "step-1", "status": "failed"}],
                                            expanded_steps_snapshot=[
                                                _seed_step(
                                                    "step-1",
                                                    1,
                                                    "Send 10 invalid login attempts",
                                                    "Rate limit message is shown",
                                                    status="failed",
                                                ),
                                            ],
                                        ),
                                        _seed_run_result(
                                            uuid.UUID(blocked_tid),
                                            "blocked",
                                            resolved_values={},
                                            step_results=[{"stepId": "step-1", "status": "blocked"}],
                                            expanded_steps_snapshot=[
                                                _seed_step(
                                                    "step-1",
                                                    1,
                                                    "Execute test scenario",
                                                    "Expected system behavior is observed",
                                                    status="blocked",
                                                ),
                                            ],
                                        ),
                                    ]
                                ),
                            },
                        )
                        failed_run.created_by = user.id
                        await artifact_repo.add(failed_run)

                        seq_run3 = await project_repo.increment_artifact_seq(first_project[0].id)
                        scale_run = ArtifactEntity(
                            project_id=first_project[0].id,
                            artifact_type="test-run",
                            title="Release gate scale sweep",
                            description="Scale-focused run with degraded outcomes to demonstrate campaign release gates.",
                            state="failed",
                            parent_id=suites_folder.id if suites_folder is not None else parent_suites_id,
                            artifact_key=f"{first_project[0].code}-{seq_run3}",
                            custom_fields={
                                "environment": "production",
                                "run_metrics_json": _seed_run_metrics(
                                    [
                                        _seed_run_result(
                                            extra_test_cases[3].id if len(extra_test_cases) > 3 else tc_login.id,
                                            "passed",
                                            resolved_values={},
                                            step_results=[{"stepId": "step-1", "status": "passed"}],
                                            expanded_steps_snapshot=[
                                                _seed_step(
                                                    "step-1",
                                                    1,
                                                    "Execute test scenario",
                                                    "Expected system behavior is observed",
                                                    status="passed",
                                                ),
                                            ],
                                        ),
                                        _seed_run_result(
                                            extra_test_cases[4].id if len(extra_test_cases) > 4 else tc_security.id,
                                            "failed",
                                            resolved_values={},
                                            step_results=[{"stepId": "step-1", "status": "failed"}],
                                            expanded_steps_snapshot=[
                                                _seed_step(
                                                    "step-1",
                                                    1,
                                                    "Execute test scenario",
                                                    "Expected system behavior is observed",
                                                    status="failed",
                                                ),
                                            ],
                                        ),
                                        _seed_run_result(
                                            extra_test_cases[7].id if len(extra_test_cases) > 7 else tc_api.id,
                                            "blocked",
                                            resolved_values={},
                                            step_results=[{"stepId": "step-1", "status": "blocked"}],
                                            expanded_steps_snapshot=[
                                                _seed_step(
                                                    "step-1",
                                                    1,
                                                    "Execute test scenario",
                                                    "Expected system behavior is observed",
                                                    status="blocked",
                                                ),
                                            ],
                                        ),
                                    ]
                                ),
                            },
                        )
                        scale_run.created_by = user.id
                        await artifact_repo.add(scale_run)

                        seq_camp = await project_repo.increment_artifact_seq(first_project[0].id)
                        demo_campaign = ArtifactEntity(
                            project_id=first_project[0].id,
                            artifact_type="test-campaign",
                            title="Demo campaign",
                            description="Sample campaign grouping suite execution.",
                            state=camp_st,
                            parent_id=suites_folder.id if suites_folder is not None else parent_suites_id,
                            artifact_key=f"{first_project[0].code}-{seq_camp}",
                            custom_fields={
                                "target_environment": "staging",
                                "campaign_config_json": json.dumps(
                                    [
                                        {
                                            "suite": "Demo regression suite",
                                            "order": 1,
                                            "entryCriteria": "smoke must pass",
                                            "focusConfiguration": "cfg-login-staging",
                                            "owner": "qa-team",
                                            "exitCriteria": "all critical smoke tests passed",
                                            "gatePolicy": "warn-on-failure",
                                        }
                                    ]
                                ),
                            },
                        )
                        demo_campaign.created_by = user.id
                        await artifact_repo.add(demo_campaign)

                        seq_camp2 = await project_repo.increment_artifact_seq(first_project[0].id)
                        release_campaign = ArtifactEntity(
                            project_id=first_project[0].id,
                            artifact_type="test-campaign",
                            title="Release readiness campaign",
                            description="Aggregates regression and API suites for release gate.",
                            state="in_progress",
                            parent_id=suites_folder.id if suites_folder is not None else parent_suites_id,
                            artifact_key=f"{first_project[0].code}-{seq_camp2}",
                            custom_fields={
                                "target_environment": "production",
                                "campaign_config_json": json.dumps(
                                    [
                                        {
                                            "suite": "Demo regression suite",
                                            "order": 1,
                                            "entryCriteria": "staging smoke passed",
                                            "focusConfiguration": "cfg-login-prod",
                                            "owner": "release-qa",
                                            "exitCriteria": "prod smoke stays green for 1 consecutive run",
                                            "gatePolicy": "hard-gate",
                                        },
                                        {
                                            "suite": "API contract suite",
                                            "order": 2,
                                            "entryCriteria": "schema baseline approved",
                                            "owner": "qa-platform",
                                            "exitCriteria": "no failed contract or auth checks",
                                            "gatePolicy": "hard-gate",
                                        },
                                        {
                                            "suite": "Scale and resilience suite",
                                            "order": 3,
                                            "entryCriteria": "regression and api suites completed",
                                            "owner": "sre-oncall",
                                            "exitCriteria": "no blocked resilience tests and <=1 tolerated perf failure",
                                            "gatePolicy": "conditional-gate",
                                            "releaseDecision": "hold-if-failed",
                                        },
                                    ]
                                ),
                            },
                        )
                        release_campaign.created_by = user.id
                        await artifact_repo.add(release_campaign)

                link_repo = SqlAlchemyArtifactLinkRepository(session)
                tag_repo = SqlAlchemyProjectTagRepository(session)
                task_repo = SqlAlchemyTaskRepository(session)

                if len(first_project) > 1:
                    p2 = first_project[1]
                    mb2 = default_version.manifest_bundle or {}
                    ast2 = get_manifest_ast(default_version.id, mb2)
                    rr2 = await artifact_repo.list_by_project(p2.id, type_filter="root-requirement")
                    rd2 = await artifact_repo.list_by_project(p2.id, type_filter="root-defect")
                    if rr2 and rd2:
                        st_e2 = workflow_get_initial_state(mb2, "epic", ast=ast2) or "new"
                        seq_p2e = await project_repo.increment_artifact_seq(p2.id)
                        epic_p2 = ArtifactEntity(
                            project_id=p2.id,
                            artifact_type="epic",
                            title="UNIMA — mobile onboarding",
                            description=(
                                "Second-project backlog: feature, two requirements, defect, and test."
                            ),
                            state=st_e2,
                            parent_id=rr2[0].id,
                            artifact_key=f"{p2.code}-{seq_p2e}",
                            custom_fields={"priority": "2"},
                        )
                        epic_p2.created_by = user.id
                        await artifact_repo.add(epic_p2)

                        st_f2 = workflow_get_initial_state(mb2, "feature", ast=ast2) or "new"
                        seq_p2f = await project_repo.increment_artifact_seq(p2.id)
                        feat_p2 = ArtifactEntity(
                            project_id=p2.id,
                            artifact_type="feature",
                            title="First-run experience",
                            description="Account creation, profile basics, and first successful login.",
                            state=st_f2,
                            parent_id=epic_p2.id,
                            artifact_key=f"{p2.code}-{seq_p2f}",
                            custom_fields={"story_points": 3},
                        )
                        feat_p2.created_by = user.id
                        await artifact_repo.add(feat_p2)

                        st_r2 = workflow_get_initial_state(mb2, "requirement", ast=ast2) or "new"
                        seq_p2r = await project_repo.increment_artifact_seq(p2.id)
                        req_p2 = ArtifactEntity(
                            project_id=p2.id,
                            artifact_type="requirement",
                            title="Email verification before workspace access",
                            description="New users must confirm email before seeing project data.",
                            state=st_r2,
                            parent_id=feat_p2.id,
                            artifact_key=f"{p2.code}-{seq_p2r}",
                            custom_fields={"priority": "high"},
                        )
                        req_p2.created_by = user.id
                        await artifact_repo.add(req_p2)

                        seq_p2r2 = await project_repo.increment_artifact_seq(p2.id)
                        req_p2_b = ArtifactEntity(
                            project_id=p2.id,
                            artifact_type="requirement",
                            title="Profile photo optional but validated when present",
                            description="If the user uploads an avatar, MIME type and dimensions are enforced.",
                            state=st_r2,
                            parent_id=feat_p2.id,
                            artifact_key=f"{p2.code}-{seq_p2r2}",
                            custom_fields={"priority": "low"},
                        )
                        req_p2_b.created_by = user.id
                        await artifact_repo.add(req_p2_b)

                        st_d2 = workflow_get_initial_state(mb2, "defect", ast=ast2) or "new"
                        seq_p2d = await project_repo.increment_artifact_seq(p2.id)
                        def_p2 = ArtifactEntity(
                            project_id=p2.id,
                            artifact_type="defect",
                            title="Verification email link expires immediately in mobile webview",
                            description="Repro on iOS in-app browser; token appears consumed on first load.",
                            state=st_d2,
                            parent_id=rd2[0].id,
                            artifact_key=f"{p2.code}-{seq_p2d}",
                            custom_fields={
                                "severity": "high",
                                "reproducible": "yes",
                                "detected_environment": "dev",
                                "defect_priority": "2",
                            },
                        )
                        def_p2.created_by = user.id
                        await artifact_repo.add(def_p2)

                        rq2 = await artifact_repo.list_by_project(p2.id, type_filter="root-quality")
                        tc_state_p2 = workflow_get_initial_state(mb2, "test-case", ast=ast2) or "new"
                        tc_uni = None
                        if rq2:
                            seq_ut = await project_repo.increment_artifact_seq(p2.id)
                            tc_uni = ArtifactEntity(
                                project_id=p2.id,
                                artifact_type="test-case",
                                title="UNIMA — email verification flow",
                                description="Manual checks for the verification gate on second demo project.",
                                state=tc_state_p2,
                                parent_id=rq2[0].id,
                                artifact_key=f"{p2.code}-{seq_ut}",
                                custom_fields={
                                    "priority": "high",
                                    "automation": "manual",
                                    "test_steps_json": _seed_test_steps(
                                        [
                                            _seed_step(
                                                "u1",
                                                1,
                                                "Register with a fresh mailbox",
                                                "Account pending verification state",
                                            ),
                                            _seed_step(
                                                "u2",
                                                2,
                                                "Open verification link from email",
                                                "User lands in workspace home",
                                            ),
                                        ]
                                    ),
                                },
                            )
                            tc_uni.created_by = user.id
                            await artifact_repo.add(tc_uni)

                        await link_repo.add(
                            ArtifactLink.create(
                                project_id=p2.id,
                                from_artifact_id=def_p2.id,
                                to_artifact_id=req_p2.id,
                                link_type="blocks",
                            )
                        )
                        if tc_uni is not None:
                            await link_repo.add(
                                ArtifactLink.create(
                                    project_id=p2.id,
                                    from_artifact_id=tc_uni.id,
                                    to_artifact_id=req_p2.id,
                                    link_type="verifies",
                                )
                            )
                            await link_repo.add(
                                ArtifactLink.create(
                                    project_id=p2.id,
                                    from_artifact_id=tc_uni.id,
                                    to_artifact_id=req_p2_b.id,
                                    link_type="verifies",
                                )
                            )

                t_security = await tag_repo.create(first_project[0].id, "security-review")
                t_customer = await tag_repo.create(first_project[0].id, "customer-alpha")
                t_release = await tag_repo.create(first_project[0].id, "release-24.3")
                await tag_repo.set_artifact_tags(
                    sample.id, first_project[0].id, [t_security.id, t_release.id]
                )
                if tc_login is not None:
                    await tag_repo.set_artifact_tags(
                        tc_login.id, first_project[0].id, [t_customer.id, t_release.id]
                    )
                if demo_defect_high is not None:
                    await tag_repo.set_artifact_tags(
                        demo_defect_high.id, first_project[0].id, [t_security.id]
                    )

                await task_repo.add(
                    TaskEntity.create(
                        first_project[0].id,
                        sample.id,
                        "Walk through acceptance criteria with product owner",
                        state="in_progress",
                        description="Demo task linked to the sample requirement.",
                        assignee_id=user.id,
                        rank_order=1.0,
                    )
                )
                if demo_defect_high is not None:
                    await task_repo.add(
                        TaskEntity.create(
                            first_project[0].id,
                            demo_defect_high.id,
                            "Capture HAR + console for logout cookie repro",
                            state="todo",
                            description="Attach artifacts to the defect when ready.",
                            assignee_id=user.id,
                            rank_order=1.0,
                        )
                    )

                await link_repo.add(
                    ArtifactLink.create(
                        project_id=first_project[0].id,
                        from_artifact_id=gov_manifest.id,
                        to_artifact_id=sample.id,
                        link_type="sample_validates_against_schema",
                    )
                )
                await link_repo.add(
                    ArtifactLink.create(
                        project_id=first_project[0].id,
                        from_artifact_id=sample.id,
                        to_artifact_id=gov_rule.id,
                        link_type="schema_constrains_rules",
                    )
                )
                if demo_defect_high is not None:
                    await link_repo.add(
                        ArtifactLink.create(
                            project_id=first_project[0].id,
                            from_artifact_id=demo_defect_high.id,
                            to_artifact_id=sample.id,
                            link_type="blocks",
                        )
                    )
                if demo_defect_medium is not None:
                    await link_repo.add(
                        ArtifactLink.create(
                            project_id=first_project[0].id,
                            from_artifact_id=demo_defect_medium.id,
                            to_artifact_id=sample.id,
                            link_type="related",
                        )
                    )
                if tc_login is not None:
                    await link_repo.add(
                        ArtifactLink.create(
                            project_id=first_project[0].id,
                            from_artifact_id=tc_login.id,
                            to_artifact_id=sample.id,
                            link_type="verifies",
                        )
                    )
                if tc_api is not None:
                    await link_repo.add(
                        ArtifactLink.create(
                            project_id=first_project[0].id,
                            from_artifact_id=tc_api.id,
                            to_artifact_id=sample.id,
                            link_type="verifies",
                        )
                    )
                if tc_security is not None:
                    await link_repo.add(
                        ArtifactLink.create(
                            project_id=first_project[0].id,
                            from_artifact_id=tc_security.id,
                            to_artifact_id=sample.id,
                            link_type="verifies",
                        )
                    )
                if tc_security is not None and req_mfa is not None:
                    await link_repo.add(
                        ArtifactLink.create(
                            project_id=first_project[0].id,
                            from_artifact_id=tc_security.id,
                            to_artifact_id=req_mfa.id,
                            link_type="verifies",
                        )
                    )
                if tc_login is not None and req_audit is not None:
                    await link_repo.add(
                        ArtifactLink.create(
                            project_id=first_project[0].id,
                            from_artifact_id=tc_login.id,
                            to_artifact_id=req_audit.id,
                            link_type="verifies",
                        )
                    )
                if tc_composite is not None and req_mfa is not None:
                    await link_repo.add(
                        ArtifactLink.create(
                            project_id=first_project[0].id,
                            from_artifact_id=tc_composite.id,
                            to_artifact_id=req_mfa.id,
                            link_type="verifies",
                        )
                    )
                if tc_composite is not None:
                    await link_repo.add(
                        ArtifactLink.create(
                            project_id=first_project[0].id,
                            from_artifact_id=tc_composite.id,
                            to_artifact_id=sample.id,
                            link_type="verifies",
                        )
                    )
                if req_audit is not None and tc_api is not None:
                    await link_repo.add(
                        ArtifactLink.create(
                            project_id=first_project[0].id,
                            from_artifact_id=tc_api.id,
                            to_artifact_id=req_audit.id,
                            link_type="verifies",
                        )
                    )
                if demo_defect_resolved is not None:
                    await link_repo.add(
                        ArtifactLink.create(
                            project_id=first_project[0].id,
                            from_artifact_id=demo_defect_resolved.id,
                            to_artifact_id=sample.id,
                            link_type="related",
                        )
                    )
                if demo_suite is not None and tc_login is not None:
                    await link_repo.add(
                        ArtifactLink.create(
                            project_id=first_project[0].id,
                            from_artifact_id=demo_suite.id,
                            to_artifact_id=tc_login.id,
                            link_type="suite_includes_test",
                        )
                    )
                if demo_suite is not None and tc_api is not None:
                    await link_repo.add(
                        ArtifactLink.create(
                            project_id=first_project[0].id,
                            from_artifact_id=demo_suite.id,
                            to_artifact_id=tc_api.id,
                            link_type="suite_includes_test",
                        )
                    )
                if demo_suite is not None and tc_composite is not None:
                    await link_repo.add(
                        ArtifactLink.create(
                            project_id=first_project[0].id,
                            from_artifact_id=demo_suite.id,
                            to_artifact_id=tc_composite.id,
                            link_type="suite_includes_test",
                        )
                    )
                if api_suite is not None and tc_api is not None:
                    await link_repo.add(
                        ArtifactLink.create(
                            project_id=first_project[0].id,
                            from_artifact_id=api_suite.id,
                            to_artifact_id=tc_api.id,
                            link_type="suite_includes_test",
                        )
                    )
                if api_suite is not None and tc_security is not None:
                    await link_repo.add(
                        ArtifactLink.create(
                            project_id=first_project[0].id,
                            from_artifact_id=api_suite.id,
                            to_artifact_id=tc_security.id,
                            link_type="suite_includes_test",
                        )
                    )
                if scale_suite is not None and tc_login is not None:
                    await link_repo.add(
                        ArtifactLink.create(
                            project_id=first_project[0].id,
                            from_artifact_id=scale_suite.id,
                            to_artifact_id=tc_login.id,
                            link_type="suite_includes_test",
                        )
                    )
                if scale_suite is not None:
                    for extra_case in extra_test_cases:
                        await link_repo.add(
                            ArtifactLink.create(
                                project_id=first_project[0].id,
                                from_artifact_id=scale_suite.id,
                                to_artifact_id=extra_case.id,
                                link_type="suite_includes_test",
                            )
                        )
                if demo_run is not None and demo_suite is not None:
                    await link_repo.add(
                        ArtifactLink.create(
                            project_id=first_project[0].id,
                            from_artifact_id=demo_run.id,
                            to_artifact_id=demo_suite.id,
                            link_type="run_for_suite",
                        )
                    )
                if previous_demo_run is not None and demo_suite is not None:
                    await link_repo.add(
                        ArtifactLink.create(
                            project_id=first_project[0].id,
                            from_artifact_id=previous_demo_run.id,
                            to_artifact_id=demo_suite.id,
                            link_type="run_for_suite",
                        )
                    )
                if failed_run is not None and api_suite is not None:
                    await link_repo.add(
                        ArtifactLink.create(
                            project_id=first_project[0].id,
                            from_artifact_id=failed_run.id,
                            to_artifact_id=api_suite.id,
                            link_type="run_for_suite",
                        )
                    )
                if scale_run is not None and scale_suite is not None:
                    await link_repo.add(
                        ArtifactLink.create(
                            project_id=first_project[0].id,
                            from_artifact_id=scale_run.id,
                            to_artifact_id=scale_suite.id,
                            link_type="run_for_suite",
                        )
                    )
                if demo_campaign is not None and demo_suite is not None:
                    await link_repo.add(
                        ArtifactLink.create(
                            project_id=first_project[0].id,
                            from_artifact_id=demo_campaign.id,
                            to_artifact_id=demo_suite.id,
                            link_type="campaign_includes_suite",
                        )
                    )
                if release_campaign is not None and demo_suite is not None:
                    await link_repo.add(
                        ArtifactLink.create(
                            project_id=first_project[0].id,
                            from_artifact_id=release_campaign.id,
                            to_artifact_id=demo_suite.id,
                            link_type="campaign_includes_suite",
                        )
                    )
                if release_campaign is not None and api_suite is not None:
                    await link_repo.add(
                        ArtifactLink.create(
                            project_id=first_project[0].id,
                            from_artifact_id=release_campaign.id,
                            to_artifact_id=api_suite.id,
                            link_type="campaign_includes_suite",
                        )
                    )
                if release_campaign is not None and scale_suite is not None:
                    await link_repo.add(
                        ArtifactLink.create(
                            project_id=first_project[0].id,
                            from_artifact_id=release_campaign.id,
                            to_artifact_id=scale_suite.id,
                            link_type="campaign_includes_suite",
                        )
                    )

            await session.commit()
            logger.info(
                "demo_data_seeded",
                email=DEMO_EMAIL,
                org=DEMO_ORG_NAME,
                projects=len(DEMO_PROJECTS),
                includes=(
                    "epic_multi_feature_requirements defects quality_campaign "
                    "tags_tasks_param_test call_plan run_metrics_ids unima_backlog"
                ),
            )
    except Exception as e:
        logger.exception("seed_demo_data_failed", error=str(e))
        raise

from __future__ import annotations

import uuid
from pathlib import Path
from typing import Any

import structlog
import yaml  # type: ignore[import-untyped]
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from alm.artifact.domain.entities import Artifact as ArtifactEntity
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
from alm.shared.domain.value_objects import ProjectCode, Slug
from alm.shared.infrastructure.security.password import hash_password
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
        {"tree_id": "defect", "root_artifact_type": "root-defect"},
    ],
}

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
    {"name": "Sample Project", "code": "SAMP", "description": "Example project for testing"},
    {"name": "Unima", "code": "UNIMA", "description": "Sample ALM project"},
]


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
                                "fields": [
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
                                        "visibleWhen": {"field": "typeName", "in": ["defect"]},
                                    },
                                ],
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
                                "child_types": ["bug"],
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
                                "id": "bug",
                                "workflow_id": "scrum",
                                "parent_types": ["root-defect"],
                                "fields": [
                                    {
                                        "id": "severity",
                                        "name": "Severity",
                                        "type": "choice",
                                        "options": [
                                            {"id": "low", "label": "Low"},
                                            {"id": "high", "label": "High"},
                                            {"id": "critical", "label": "Critical"},
                                        ],
                                        "visibleWhen": {"field": "typeName", "in": ["bug"]},
                                    }
                                ],
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
                                "child_types": ["bug"],
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
                                "id": "bug",
                                "workflow_id": "kanban",
                                "parent_types": ["root-defect"],
                                "fields": [
                                    {
                                        "id": "severity",
                                        "name": "Severity",
                                        "type": "choice",
                                        "options": [{"id": "low", "label": "Low"}, {"id": "high", "label": "High"}],
                                        "visibleWhen": {"field": "typeName", "in": ["bug"]},
                                    }
                                ],
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
                                "child_types": [],
                                "fields": [],
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
    """Create root artifacts (R0, Q0, D0) for a project when manifest defines them (used in seed only)."""
    ast = get_manifest_ast(version_id, manifest_bundle)
    state_req = workflow_get_initial_state(manifest_bundle, "root-requirement", ast=ast)
    state_qual = workflow_get_initial_state(manifest_bundle, "root-quality", ast=ast)
    if state_req is None or state_qual is None:
        return
    root_req = ArtifactEntity.create(
        project_id=project.id,
        artifact_type="root-requirement",
        title=project.name,
        state=state_req,
        parent_id=None,
        artifact_key=f"{project.code}-R0",
    )
    root_qual = ArtifactEntity.create(
        project_id=project.id,
        artifact_type="root-quality",
        title=project.name,
        state=state_qual,
        parent_id=None,
        artifact_key=f"{project.code}-Q0",
    )
    await artifact_repo.add(root_req)
    await artifact_repo.add(root_qual)

    state_defect = workflow_get_initial_state(manifest_bundle, "root-defect", ast=ast)
    if state_defect is not None:
        root_defect = ArtifactEntity.create(
            project_id=project.id,
            artifact_type="root-defect",
            title=project.name,
            state=state_defect,
            parent_id=None,
            artifact_key=f"{project.code}-D0",
        )
        await artifact_repo.add(root_defect)


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
            if first_project and version_id:
                root_req_list = await artifact_repo.list_by_project(first_project[0].id, type_filter="root-requirement")
                parent_id = root_req_list[0].id if root_req_list else None
                seq = await project_repo.increment_artifact_seq(first_project[0].id)
                sample = ArtifactEntity(
                    project_id=first_project[0].id,
                    artifact_type="requirement",
                    title="Sample requirement",
                    description="Example artifact for demo",
                    state="new",
                    parent_id=parent_id,
                    artifact_key=f"{first_project[0].code}-{seq}",
                    custom_fields={"governance_artifact_id": "schema.cycle.v1"},
                )
                sample.created_by = user.id
                await artifact_repo.add(sample)

                seq_manifest = await project_repo.increment_artifact_seq(first_project[0].id)
                gov_manifest = ArtifactEntity(
                    project_id=first_project[0].id,
                    artifact_type="requirement",
                    title="Governance anchor: manifest sample (demo)",
                    description="Maps to artifact_catalog manifest_sample.cycle.minimal for traceability export",
                    state="new",
                    parent_id=parent_id,
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
                    state="new",
                    parent_id=parent_id,
                    artifact_key=f"{first_project[0].code}-{seq_rule}",
                    custom_fields={"governance_artifact_id": "rule_pack.cycle.v1"},
                )
                gov_rule.created_by = user.id
                await artifact_repo.add(gov_rule)

                root_qual_list = await artifact_repo.list_by_project(first_project[0].id, type_filter="root-quality")
                parent_qual_id = root_qual_list[0].id if root_qual_list else None
                tc_state = "new"
                if default_version and default_version.manifest_bundle and parent_qual_id:
                    ast_tc = get_manifest_ast(default_version.id, default_version.manifest_bundle)
                    tc_state = (
                        workflow_get_initial_state(default_version.manifest_bundle, "test-case", ast=ast_tc) or "new"
                    )

                quality_folder = None
                tc_login = None
                tc_api = None
                tc_security = None
                demo_suite = None
                api_suite = None
                demo_run = None
                failed_run = None
                demo_campaign = None
                release_campaign = None
                if parent_qual_id:
                    seq_qf = await project_repo.increment_artifact_seq(first_project[0].id)
                    quality_folder = ArtifactEntity(
                        project_id=first_project[0].id,
                        artifact_type="quality-folder",
                        title="Sprint 24 - Quality",
                        description="Seeded quality folder to demonstrate nested quality artifacts.",
                        state="Active",
                        parent_id=parent_qual_id,
                        artifact_key=f"{first_project[0].code}-{seq_qf}",
                        custom_fields={},
                    )
                    quality_folder.created_by = user.id
                    await artifact_repo.add(quality_folder)

                    seq_tc1 = await project_repo.increment_artifact_seq(first_project[0].id)
                    tc_login = ArtifactEntity(
                        project_id=first_project[0].id,
                        artifact_type="test-case",
                        title="Login — happy path",
                        description="Demo test case under the Quality tree; links to the sample requirement.",
                        state=tc_state,
                        parent_id=quality_folder.id if quality_folder is not None else parent_qual_id,
                        artifact_key=f"{first_project[0].code}-{seq_tc1}",
                        custom_fields={
                            "priority": "high",
                            "automation": "manual",
                            "test_steps_json": (
                                '[{"stepNumber":1,"action":"Open login page","expectedResult":"Login form is visible"},'
                                '{"stepNumber":2,"action":"Submit valid credentials",'
                                '"expectedResult":"Redirect to dashboard"}]'
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
                        parent_id=quality_folder.id if quality_folder is not None else parent_qual_id,
                        artifact_key=f"{first_project[0].code}-{seq_tc2}",
                        custom_fields={
                            "priority": "medium",
                            "automation": "automated",
                            "test_steps_json": (
                                '[{"stepNumber":1,"action":"Send invalid payload",'
                                '"expectedResult":"HTTP 400 with schema errors"}]'
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
                        parent_id=quality_folder.id if quality_folder is not None else parent_qual_id,
                        artifact_key=f"{first_project[0].code}-{seq_tc3}",
                        custom_fields={
                            "priority": "critical",
                            "automation": "manual",
                            "test_steps_json": (
                                '[{"stepNumber":1,"action":"Send 10 invalid login attempts",'
                                '"expectedResult":"Rate limit message is shown"}]'
                            ),
                        },
                    )
                    tc_security.created_by = user.id
                    await artifact_repo.add(tc_security)

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
                            parent_id=quality_folder.id if quality_folder is not None else parent_qual_id,
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
                            parent_id=quality_folder.id if quality_folder is not None else parent_qual_id,
                            artifact_key=f"{first_project[0].code}-{seq_su2}",
                            custom_fields={"suite_note": "API + security"},
                        )
                        api_suite.created_by = user.id
                        await artifact_repo.add(api_suite)

                        seq_run = await project_repo.increment_artifact_seq(first_project[0].id)
                        demo_run = ArtifactEntity(
                            project_id=first_project[0].id,
                            artifact_type="test-run",
                            title="Demo test run",
                            description="Sample run against the demo suite.",
                            state=run_st,
                            parent_id=quality_folder.id if quality_folder is not None else parent_qual_id,
                            artifact_key=f"{first_project[0].code}-{seq_run}",
                            custom_fields={
                                "environment": "staging",
                                "run_metrics_json": '{"passed":2,"failed":0,"blocked":0}',
                            },
                        )
                        demo_run.created_by = user.id
                        await artifact_repo.add(demo_run)

                        seq_run2 = await project_repo.increment_artifact_seq(first_project[0].id)
                        failed_run = ArtifactEntity(
                            project_id=first_project[0].id,
                            artifact_type="test-run",
                            title="Nightly API run - failed",
                            description="Seeded failed run to demonstrate run status distribution.",
                            state="failed",
                            parent_id=quality_folder.id if quality_folder is not None else parent_qual_id,
                            artifact_key=f"{first_project[0].code}-{seq_run2}",
                            custom_fields={
                                "environment": "staging",
                                "run_metrics_json": '{"passed":1,"failed":1,"blocked":1}',
                            },
                        )
                        failed_run.created_by = user.id
                        await artifact_repo.add(failed_run)

                        seq_camp = await project_repo.increment_artifact_seq(first_project[0].id)
                        demo_campaign = ArtifactEntity(
                            project_id=first_project[0].id,
                            artifact_type="test-campaign",
                            title="Demo campaign",
                            description="Sample campaign grouping suite execution.",
                            state=camp_st,
                            parent_id=quality_folder.id if quality_folder is not None else parent_qual_id,
                            artifact_key=f"{first_project[0].code}-{seq_camp}",
                            custom_fields={
                                "target_environment": "staging",
                                "campaign_config_json": '[{"suite":"Demo regression suite","order":1}]',
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
                            parent_id=quality_folder.id if quality_folder is not None else parent_qual_id,
                            artifact_key=f"{first_project[0].code}-{seq_camp2}",
                            custom_fields={
                                "target_environment": "production",
                                "campaign_config_json": (
                                    '[{"suite":"Demo regression suite","order":1},'
                                    '{"suite":"API contract suite","order":2}]'
                                ),
                            },
                        )
                        release_campaign.created_by = user.id
                        await artifact_repo.add(release_campaign)

                link_repo = SqlAlchemyArtifactLinkRepository(session)
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
                if demo_run is not None and demo_suite is not None:
                    await link_repo.add(
                        ArtifactLink.create(
                            project_id=first_project[0].id,
                            from_artifact_id=demo_run.id,
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

            await session.commit()
            logger.info(
                "demo_data_seeded",
                email=DEMO_EMAIL,
                org=DEMO_ORG_NAME,
                projects=len(DEMO_PROJECTS),
            )
    except Exception as e:
        logger.exception("seed_demo_data_failed", error=str(e))
        raise

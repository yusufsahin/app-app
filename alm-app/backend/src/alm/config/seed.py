from __future__ import annotations

from pathlib import Path

import structlog
import yaml
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from alm.auth.domain.entities import User
from alm.config.settings import settings
from alm.project.domain.entities import Project
from alm.shared.domain.value_objects import ProjectCode, Slug
from alm.shared.infrastructure.security.password import hash_password
from alm.tenant.domain.entities import Privilege
from alm.tenant.domain.services import TenantOnboardingSaga
from alm.tenant.infrastructure.repositories import (
    SqlAlchemyMembershipRepository,
    SqlAlchemyPrivilegeRepository,
    SqlAlchemyRoleRepository,
    SqlAlchemyTenantRepository,
)
from alm.auth.infrastructure.repositories import SqlAlchemyUserRepository
from alm.project.infrastructure.repositories import SqlAlchemyProjectRepository
from alm.artifact.domain.entities import Artifact as ArtifactEntity
from alm.artifact.infrastructure.repositories import SqlAlchemyArtifactRepository
from alm.process_template.infrastructure.repositories import (
    SqlAlchemyProcessTemplateRepository,
)
from alm.tenant.infrastructure.models import TenantModel

logger = structlog.get_logger()

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
        logger.warning("seed_file_not_found", path=str(yaml_path))
        return

    with yaml_path.open() as f:
        data = yaml.safe_load(f)

    definitions: list[dict] = data.get("privileges", [])
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


async def seed_process_templates(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    """Seed built-in process templates (Basic) if empty."""
    from sqlalchemy import select
    from alm.process_template.infrastructure.models import (
        ProcessTemplateModel,
        ProcessTemplateVersionModel,
    )

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
            manifest_bundle={
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
                            {"id": "story_points", "name": "Story Points", "type": "number", "requiredWhen": {"field": "typeName", "eq": "feature"}},
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
                ],
            },
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
            manifest_bundle={
                "schemaVersion": 1,
                "namespace": "alm",
                "name": "scrum",
                "manifestVersion": "1.0.0",
                "defs": [
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
                    },
                    {"kind": "ArtifactType", "id": "epic", "workflow_id": "scrum", "child_types": ["feature"], "fields": [{"id": "priority", "name": "Priority", "type": "string"}]},
                    {"kind": "ArtifactType", "id": "feature", "workflow_id": "scrum", "parent_types": ["epic"], "child_types": ["user_story"], "fields": [{"id": "story_points", "name": "Story Points", "type": "number"}]},
                    {"kind": "ArtifactType", "id": "user_story", "workflow_id": "scrum", "parent_types": ["feature"], "fields": [{"id": "story_points", "name": "Story Points", "type": "number", "requiredWhen": {"field": "typeName", "eq": "user_story"}}, {"id": "acceptance_criteria", "name": "Acceptance Criteria", "type": "string"}]},
                    {"kind": "ArtifactType", "id": "bug", "workflow_id": "scrum", "fields": [{"id": "severity", "name": "Severity", "type": "choice", "options": [{"id": "low", "label": "Low"}, {"id": "high", "label": "High"}, {"id": "critical", "label": "Critical"}], "visibleWhen": {"field": "typeName", "in": ["bug"]}}]},
                    {"kind": "TransitionPolicy", "id": "assignee_in_progress", "when": {"state": "in_progress"}, "require": "assignee"},
                ],
            },
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
            manifest_bundle={
                "schemaVersion": 1,
                "namespace": "alm",
                "name": "kanban",
                "manifestVersion": "1.0.0",
                "defs": [
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
                    },
                    {"kind": "ArtifactType", "id": "epic", "workflow_id": "kanban", "child_types": ["feature"], "fields": [{"id": "priority", "name": "Priority", "type": "string"}]},
                    {"kind": "ArtifactType", "id": "feature", "workflow_id": "kanban", "parent_types": ["epic"], "child_types": ["task"], "fields": [{"id": "story_points", "name": "Story Points", "type": "number"}]},
                    {"kind": "ArtifactType", "id": "task", "workflow_id": "kanban", "parent_types": ["feature"], "fields": [{"id": "priority", "name": "Priority", "type": "string"}]},
                    {"kind": "ArtifactType", "id": "bug", "workflow_id": "kanban", "fields": [{"id": "severity", "name": "Severity", "type": "choice", "options": [{"id": "low", "label": "Low"}, {"id": "high", "label": "High"}], "visibleWhen": {"field": "typeName", "in": ["bug"]}}]},
                    {"kind": "TransitionPolicy", "id": "assignee_in_progress", "when": {"state": "in_progress"}, "require": "assignee"},
                ],
            },
        )
        session.add(kanban_version)

        await session.commit()
        logger.info("process_templates_seeded", templates=["basic", "scrum", "kanban"])


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

    logger.info("seeding_demo_data")

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

        artifact_repo = SqlAlchemyArtifactRepository(session)
        first_project = await project_repo.list_by_tenant(provisioned.tenant_id)
        if first_project and version_id:
            sample = ArtifactEntity(
                project_id=first_project[0].id,
                artifact_type="requirement",
                title="Sample requirement",
                description="Example artifact for demo",
                state="new",
            )
            sample.created_by = user.id
            await artifact_repo.add(sample)

        await session.commit()
        logger.info(
            "demo_data_seeded",
            email=DEMO_EMAIL,
            org=DEMO_ORG_NAME,
            projects=len(DEMO_PROJECTS),
        )

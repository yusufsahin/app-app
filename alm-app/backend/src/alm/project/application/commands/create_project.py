from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.artifact.domain.entities import Artifact
from alm.artifact.domain.ports import ArtifactRepository
from alm.artifact.domain.manifest_workflow_metadata import get_tree_root_type_map
from alm.artifact.domain.workflow_sm import get_initial_state as workflow_get_initial_state
from alm.config.settings import settings
from alm.process_template.domain.ports import ProcessTemplateRepository
from alm.project.application.dtos import ProjectDTO
from alm.project.domain.entities import Project
from alm.project.domain.ports import ProjectMemberRepository, ProjectRepository
from alm.project.domain.project_member import ProjectMember
from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ConflictError, ValidationError
from alm.shared.domain.value_objects import ProjectCode, Slug
from alm.tenant.domain.ports import TenantRepository

# Tenant JSON settings: optional org-wide default when CreateProject omits process_template_slug.
TENANT_SETTINGS_DEFAULT_PROCESS_TEMPLATE_SLUG_KEY = "default_process_template_slug"


@dataclass(frozen=True)
class CreateProject(Command):
    tenant_id: uuid.UUID
    code: str
    name: str
    description: str = ""
    process_template_slug: str | None = None
    created_by: uuid.UUID | None = None


class CreateProjectHandler(CommandHandler[ProjectDTO]):
    def __init__(
        self,
        project_repo: ProjectRepository,
        process_template_repo: ProcessTemplateRepository,
        project_member_repo: ProjectMemberRepository,
        artifact_repo: ArtifactRepository,
        tenant_repo: TenantRepository,
    ) -> None:
        self._project_repo = project_repo
        self._process_template_repo = process_template_repo
        self._project_member_repo = project_member_repo
        self._artifact_repo = artifact_repo
        self._tenant_repo = tenant_repo

    async def handle(self, command: Command) -> ProjectDTO:
        assert isinstance(command, CreateProject)

        try:
            project_code = ProjectCode.from_string(command.code)
        except ValueError as e:
            raise ValidationError(str(e)) from e

        slug = Slug.from_string(command.name)

        existing_code = await self._project_repo.find_by_tenant_and_code(command.tenant_id, project_code.value)
        if existing_code is not None:
            raise ConflictError(f"Project with code '{project_code.value}' already exists in this tenant")

        existing_slug = await self._project_repo.find_by_tenant_and_slug(command.tenant_id, slug.value)
        if existing_slug is not None:
            raise ConflictError(f"Project with slug '{slug.value}' already exists in this tenant")

        if command.process_template_slug and str(command.process_template_slug).strip():
            template_slug = str(command.process_template_slug).strip()
        else:
            from_tenant: str | None = None
            tenant = await self._tenant_repo.find_by_id(command.tenant_id)
            if tenant and isinstance(tenant.settings, dict):
                raw = tenant.settings.get(TENANT_SETTINGS_DEFAULT_PROCESS_TEMPLATE_SLUG_KEY)
                if isinstance(raw, str) and raw.strip():
                    from_tenant = raw.strip()
            template_slug = from_tenant or settings.default_process_template_slug
        version = await self._process_template_repo.find_version_by_template_slug(template_slug)
        project = Project.create(
            tenant_id=command.tenant_id,
            name=command.name,
            slug=slug.value,
            code=project_code.value,
            description=command.description,
        )
        if version is not None:
            project.process_template_version_id = version.id
        project.created_by = command.created_by
        project = await self._project_repo.add(project)

        if command.created_by:
            member = ProjectMember(
                id=uuid.uuid4(),
                project_id=project.id,
                user_id=command.created_by,
                role="PROJECT_ADMIN",
            )
            await self._project_member_repo.add(member)

        if project.process_template_version_id:
            await self._create_project_roots(project)

        return ProjectDTO(
            id=project.id,
            code=project.code,
            name=project.name,
            slug=project.slug,
            description=project.description,
            status=project.status,
            settings=project.settings,
            metadata_=project.metadata_,
        )

    async def _create_project_roots(self, project: Project) -> None:
        """Create project roots from manifest tree_roots (requirements / tests / Campaign tree testsuites / defects)."""
        from alm.artifact.domain.mpc_resolver import get_manifest_ast

        version = await self._process_template_repo.find_version_by_id(project.process_template_version_id)
        if not version or not version.manifest_bundle:
            return
        manifest = version.manifest_bundle
        ast = get_manifest_ast(version.id, manifest)
        root_type_map = get_tree_root_type_map(manifest)
        root_types = list(dict.fromkeys(root_type_map.values()))
        key_suffix_map = {
            "root-requirement": "R0",
            "root-tests": "T0",
            "root-testsuites": "TS0",
            "root-defect": "D0",
            "root-quality": "Q0",
        }

        for root_type in root_types:
            state = workflow_get_initial_state(manifest, root_type, ast=ast)
            if state is None:
                continue
            suffix = key_suffix_map.get(root_type, f"{root_type.upper()}0")
            root = Artifact.create(
                project_id=project.id,
                artifact_type=root_type,
                title=project.name,
                state=state,
                parent_id=None,
                artifact_key=f"{project.code}-{suffix}",
            )
            await self._artifact_repo.add(root)

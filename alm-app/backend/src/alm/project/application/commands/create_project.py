from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.artifact.domain.entities import Artifact
from alm.artifact.domain.ports import ArtifactRepository
from alm.artifact.domain.workflow_sm import get_initial_state as workflow_get_initial_state
from alm.process_template.domain.ports import ProcessTemplateRepository
from alm.project.application.dtos import ProjectDTO
from alm.project.domain.entities import Project
from alm.project.domain.ports import ProjectMemberRepository, ProjectRepository
from alm.project.domain.project_member import ProjectMember
from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ConflictError, ValidationError
from alm.shared.domain.value_objects import ProjectCode, Slug


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
    ) -> None:
        self._project_repo = project_repo
        self._process_template_repo = process_template_repo
        self._project_member_repo = project_member_repo
        self._artifact_repo = artifact_repo

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

        template_slug = command.process_template_slug or "basic"
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
        """Create root artifacts (root-requirement, root-quality, root-defect) when template defines them."""
        from alm.artifact.domain.mpc_resolver import get_manifest_ast

        version = await self._process_template_repo.find_version_by_id(project.process_template_version_id)
        if not version or not version.manifest_bundle:
            return
        manifest = version.manifest_bundle
        ast = get_manifest_ast(version.id, manifest)
        state_req = workflow_get_initial_state(manifest, "root-requirement", ast=ast)
        state_qual = workflow_get_initial_state(manifest, "root-quality", ast=ast)
        if state_req is None or state_qual is None:
            return
        root_req = Artifact.create(
            project_id=project.id,
            artifact_type="root-requirement",
            title=project.name,
            state=state_req,
            parent_id=None,
            artifact_key=f"{project.code}-R0",
        )
        root_qual = Artifact.create(
            project_id=project.id,
            artifact_type="root-quality",
            title=project.name,
            state=state_qual,
            parent_id=None,
            artifact_key=f"{project.code}-Q0",
        )
        await self._artifact_repo.add(root_req)
        await self._artifact_repo.add(root_qual)

        state_defect = workflow_get_initial_state(manifest, "root-defect", ast=ast)
        if state_defect is not None:
            root_defect = Artifact.create(
                project_id=project.id,
                artifact_type="root-defect",
                title=project.name,
                state=state_defect,
                parent_id=None,
                artifact_key=f"{project.code}-D0",
            )
            await self._artifact_repo.add(root_defect)

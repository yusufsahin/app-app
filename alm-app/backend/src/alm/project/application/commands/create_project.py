from __future__ import annotations

import uuid
from dataclasses import dataclass

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
    ) -> None:
        self._project_repo = project_repo
        self._process_template_repo = process_template_repo
        self._project_member_repo = project_member_repo

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

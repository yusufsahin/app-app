from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ConflictError, ValidationError
from alm.shared.domain.value_objects import ProjectCode, Slug
from alm.project.application.dtos import ProjectDTO
from alm.project.domain.entities import Project
from alm.project.domain.ports import ProjectRepository
from alm.process_template.domain.ports import ProcessTemplateRepository


@dataclass(frozen=True)
class CreateProject(Command):
    tenant_id: uuid.UUID
    code: str
    name: str
    description: str = ""
    created_by: uuid.UUID | None = None


class CreateProjectHandler(CommandHandler[ProjectDTO]):
    def __init__(
        self,
        project_repo: ProjectRepository,
        process_template_repo: ProcessTemplateRepository,
    ) -> None:
        self._project_repo = project_repo
        self._process_template_repo = process_template_repo

    async def handle(self, command: Command) -> ProjectDTO:
        assert isinstance(command, CreateProject)

        try:
            project_code = ProjectCode.from_string(command.code)
        except ValueError as e:
            raise ValidationError(str(e)) from e

        slug = Slug.from_string(command.name)

        existing_code = await self._project_repo.find_by_tenant_and_code(
            command.tenant_id, project_code.value
        )
        if existing_code is not None:
            raise ConflictError(
                f"Project with code '{project_code.value}' already exists in this tenant"
            )

        existing_slug = await self._project_repo.find_by_tenant_and_slug(
            command.tenant_id, slug.value
        )
        if existing_slug is not None:
            raise ConflictError(
                f"Project with slug '{slug.value}' already exists in this tenant"
            )

        default_version = await self._process_template_repo.find_default_version()
        project = Project.create(
            tenant_id=command.tenant_id,
            name=command.name,
            slug=slug.value,
            code=project_code.value,
            description=command.description,
        )
        if default_version is not None:
            project.process_template_version_id = default_version.id
        project.created_by = command.created_by
        project = await self._project_repo.add(project)

        return ProjectDTO(
            id=project.id,
            code=project.code,
            name=project.name,
            slug=project.slug,
            description=project.description,
        )

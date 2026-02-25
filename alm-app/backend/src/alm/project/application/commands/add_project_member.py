"""Add project member command."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.project.application.dtos import ProjectMemberDTO
from alm.project.domain.ports import ProjectMemberRepository, ProjectRepository
from alm.project.domain.project_member import ProjectMember
from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ConflictError, ValidationError


@dataclass(frozen=True)
class AddProjectMember(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    user_id: uuid.UUID
    role: str = "PROJECT_VIEWER"


class AddProjectMemberHandler(CommandHandler[ProjectMemberDTO]):
    def __init__(
        self,
        project_repo: ProjectRepository,
        project_member_repo: ProjectMemberRepository,
    ) -> None:
        self._project_repo = project_repo
        self._project_member_repo = project_member_repo

    async def handle(self, command: Command) -> ProjectMemberDTO:
        assert isinstance(command, AddProjectMember)

        project = await self._project_repo.find_by_id(command.project_id)
        if project is None or project.tenant_id != command.tenant_id:
            raise ValidationError("Project not found")

        existing = await self._project_member_repo.find_by_project_and_user(command.project_id, command.user_id)
        if existing is not None:
            raise ConflictError("User is already a member of this project")

        role = command.role or "PROJECT_VIEWER"
        member = ProjectMember(
            id=uuid.uuid4(),
            project_id=command.project_id,
            user_id=command.user_id,
            role=role,
        )
        added = await self._project_member_repo.add(member)
        return ProjectMemberDTO(
            id=added.id,
            project_id=added.project_id,
            user_id=added.user_id,
            role=added.role,
        )

"""Update project member (e.g. role) command."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.project.application.dtos import ProjectMemberDTO
from alm.project.domain.ports import ProjectMemberRepository, ProjectRepository
from alm.project.domain.project_member import ProjectMember
from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ValidationError


@dataclass(frozen=True)
class UpdateProjectMember(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    user_id: uuid.UUID
    role: str


class UpdateProjectMemberHandler(CommandHandler[ProjectMemberDTO]):
    def __init__(
        self,
        project_repo: ProjectRepository,
        project_member_repo: ProjectMemberRepository,
    ) -> None:
        self._project_repo = project_repo
        self._project_member_repo = project_member_repo

    async def handle(self, command: Command) -> ProjectMemberDTO:
        assert isinstance(command, UpdateProjectMember)

        project = await self._project_repo.find_by_id(command.project_id)
        if project is None or project.tenant_id != command.tenant_id:
            raise ValidationError("Project not found")

        member = await self._project_member_repo.find_by_project_and_user(command.project_id, command.user_id)
        if member is None:
            raise ValidationError("Project member not found")

        if not command.role or not command.role.strip():
            raise ValidationError("Role is required")

        new_member = ProjectMember(
            id=member.id,
            project_id=member.project_id,
            user_id=member.user_id,
            role=command.role.strip(),
        )
        await self._project_member_repo.update(new_member)
        return ProjectMemberDTO(
            id=new_member.id,
            project_id=new_member.project_id,
            user_id=new_member.user_id,
            role=new_member.role,
        )

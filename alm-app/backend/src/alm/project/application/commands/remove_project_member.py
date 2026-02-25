"""Remove project member command."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.project.domain.ports import ProjectMemberRepository, ProjectRepository
from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ValidationError


@dataclass(frozen=True)
class RemoveProjectMember(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    user_id: uuid.UUID


class RemoveProjectMemberHandler(CommandHandler[bool]):
    def __init__(
        self,
        project_repo: ProjectRepository,
        project_member_repo: ProjectMemberRepository,
    ) -> None:
        self._project_repo = project_repo
        self._project_member_repo = project_member_repo

    async def handle(self, command: Command) -> bool:
        assert isinstance(command, RemoveProjectMember)

        project = await self._project_repo.find_by_id(command.project_id)
        if project is None or project.tenant_id != command.tenant_id:
            raise ValidationError("Project not found")

        member = await self._project_member_repo.find_by_project_and_user(command.project_id, command.user_id)
        if member is None:
            return False
        if member.role == "PROJECT_ADMIN":
            admins = [
                m
                for m in await self._project_member_repo.list_by_project(command.project_id)
                if m.role == "PROJECT_ADMIN"
            ]
            if len(admins) <= 1:
                raise ValidationError("Cannot remove the last project admin. Assign another admin first.")

        deleted = await self._project_member_repo.delete_by_project_and_user(command.project_id, command.user_id)
        return deleted

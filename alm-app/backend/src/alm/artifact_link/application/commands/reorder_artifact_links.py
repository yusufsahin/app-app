"""Reorder outgoing artifact links (e.g. suite test order)."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.artifact_link.domain.ports import ArtifactLinkRepository
from alm.project.domain.ports import ProjectRepository
from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ValidationError


@dataclass(frozen=True)
class ReorderOutgoingArtifactLinks(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    from_artifact_id: uuid.UUID
    link_type: str
    ordered_link_ids: list[uuid.UUID]


class ReorderOutgoingArtifactLinksHandler(CommandHandler[None]):
    def __init__(
        self,
        link_repo: ArtifactLinkRepository,
        project_repo: ProjectRepository,
    ) -> None:
        self._link_repo = link_repo
        self._project_repo = project_repo

    async def handle(self, command: Command) -> None:
        assert isinstance(command, ReorderOutgoingArtifactLinks)

        project = await self._project_repo.find_by_id(command.project_id)
        if project is None or project.tenant_id != command.tenant_id:
            raise ValidationError("Project not found")

        link_type = (command.link_type or "").strip().lower()
        if not link_type:
            raise ValidationError("link_type is required")

        current = await self._link_repo.list_outgoing_link_ids(
            command.project_id,
            command.from_artifact_id,
            link_type,
        )
        current_set = set(current)
        ordered = command.ordered_link_ids
        if len(ordered) != len(current_set) or set(ordered) != current_set:
            raise ValidationError(
                "ordered_link_ids must contain exactly the same link ids as existing outgoing links"
            )

        await self._link_repo.set_sort_orders_for_outgoing(
            command.project_id,
            command.from_artifact_id,
            link_type,
            ordered,
        )

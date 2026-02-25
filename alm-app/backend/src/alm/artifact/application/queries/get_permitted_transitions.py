"""Get permitted workflow transitions for an artifact (by current state)."""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.query import Query, QueryHandler
from alm.artifact.domain.ports import ArtifactRepository
from alm.artifact.domain.mpc_resolver import get_manifest_ast
from alm.artifact.domain.workflow_sm import get_permitted_triggers
from alm.project.domain.ports import ProjectRepository
from alm.process_template.domain.ports import ProcessTemplateRepository


@dataclass(frozen=True)
class GetPermittedTransitions(Query):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    artifact_id: uuid.UUID


@dataclass(frozen=True)
class PermittedTransitionDTO:
    trigger: str
    to_state: str
    label: str


class GetPermittedTransitionsHandler(QueryHandler[list[PermittedTransitionDTO]]):
    def __init__(
        self,
        artifact_repo: ArtifactRepository,
        project_repo: ProjectRepository,
        process_template_repo: ProcessTemplateRepository,
    ) -> None:
        self._artifact_repo = artifact_repo
        self._project_repo = project_repo
        self._process_template_repo = process_template_repo

    async def handle(self, query: Query) -> list[PermittedTransitionDTO]:
        assert isinstance(query, GetPermittedTransitions)

        project = await self._project_repo.find_by_id(query.project_id)
        if project is None or project.tenant_id != query.tenant_id:
            return []

        artifact = await self._artifact_repo.find_by_id(query.artifact_id)
        if artifact is None or artifact.project_id != query.project_id:
            return []

        if project.process_template_version_id is None:
            return []

        version = await self._process_template_repo.find_version_by_id(
            project.process_template_version_id
        )
        if version is None:
            return []

        manifest = version.manifest_bundle or {}
        ast = get_manifest_ast(version.id, manifest)
        permitted = get_permitted_triggers(
            manifest,
            artifact.artifact_type,
            artifact.state,
            ast=ast,
            entity_snapshot=artifact.to_snapshot_dict(),
        )
        return [
            PermittedTransitionDTO(trigger=trigger, to_state=to_state, label=label)
            for trigger, to_state, label in permitted
        ]

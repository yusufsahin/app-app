"""Get artifact by ID."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, replace

from alm.artifact.application.dtos import ArtifactDTO
from alm.artifact.domain.mpc_resolver import get_manifest_ast, redact_data
from alm.artifact.domain.ports import ArtifactRepository
from alm.process_template.domain.ports import ProcessTemplateRepository
from alm.project.application.services.effective_process_template_version import (
    effective_process_template_version,
)
from alm.project.domain.ports import ProjectRepository
from alm.project_tag.domain.ports import ProjectTagRepository
from alm.shared.application.query import Query, QueryHandler


@dataclass(frozen=True)
class GetArtifact(Query):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    artifact_id: uuid.UUID
    actor_roles: list[str] | None = None


class GetArtifactHandler(QueryHandler[ArtifactDTO | None]):
    def __init__(
        self,
        artifact_repo: ArtifactRepository,
        project_repo: ProjectRepository,
        process_template_repo: ProcessTemplateRepository,
        tag_repo: ProjectTagRepository,
    ) -> None:
        self._artifact_repo = artifact_repo
        self._project_repo = project_repo
        self._process_template_repo = process_template_repo
        self._tag_repo = tag_repo

    async def handle(self, query: Query) -> ArtifactDTO | None:
        assert isinstance(query, GetArtifact)

        project = await self._project_repo.find_by_id(query.project_id)
        if project is None or project.tenant_id != query.tenant_id:
            return None

        artifact = await self._artifact_repo.find_by_id(query.artifact_id)
        if artifact is None or artifact.project_id != query.project_id:
            return None

        tag_map = await self._tag_repo.get_tags_by_artifact_ids([artifact.id])
        tags = tag_map.get(artifact.id, ())

        dto = ArtifactDTO(
            id=artifact.id,
            project_id=artifact.project_id,
            artifact_type=artifact.artifact_type,
            title=artifact.title,
            description=artifact.description,
            state=artifact.state,
            assignee_id=artifact.assignee_id,
            parent_id=artifact.parent_id,
            custom_fields=artifact.custom_fields,
            artifact_key=artifact.artifact_key,
            state_reason=artifact.state_reason,
            resolution=artifact.resolution,
            rank_order=artifact.rank_order,
            cycle_id=getattr(artifact, "cycle_id", None),
            area_node_id=getattr(artifact, "area_node_id", None),
            area_path_snapshot=getattr(artifact, "area_path_snapshot", None),
            team_id=getattr(artifact, "team_id", None),
            created_at=getattr(artifact, "created_at", None),
            updated_at=getattr(artifact, "updated_at", None),
            stale_traceability=getattr(artifact, "stale_traceability", False),
            stale_traceability_reason=getattr(artifact, "stale_traceability_reason", None),
            stale_traceability_at=getattr(artifact, "stale_traceability_at", None),
            tags=tags,
        )

        version = await effective_process_template_version(
            self._process_template_repo, project.process_template_version_id
        )
        if version and version.manifest_bundle:
            ast = get_manifest_ast(version.id, version.manifest_bundle)
            redacted_snapshot = redact_data(
                ast,
                dto.__dict__,  # Redactor can handle dicts
                query.actor_roles or [],
            )
            dto_fields = dto.__dataclass_fields__
            updates = {k: v for k, v in redacted_snapshot.items() if k in dto_fields}
            if updates:
                dto = replace(dto, **updates)

        return dto

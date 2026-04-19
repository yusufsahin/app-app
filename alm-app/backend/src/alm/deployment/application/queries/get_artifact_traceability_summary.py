"""Aggregate deployment events and SCM links for one artifact."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Literal

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from alm.artifact.domain.ports import ArtifactRepository
from alm.deployment.application.traceability_dtos import (
    ArtifactTraceabilitySummaryDTO,
    EnvironmentDeploySummaryDTO,
    ScmLinkSummaryItemDTO,
)
from alm.deployment.infrastructure.models import DeploymentEventModel
from alm.project.domain.ports import ProjectRepository
from alm.scm.infrastructure.repositories import SqlAlchemyScmLinkRepository
from alm.shared.application.query import Query, QueryHandler
from alm.shared.domain.exceptions import ValidationError


def _matched_via(
    *,
    artifact_key: str | None,
    key_upper: str | None,
    shas_lower: set[str],
    row: DeploymentEventModel,
) -> Literal["artifact_key", "commit_sha"]:
    keys = row.artifact_keys or []
    if key_upper and any((k or "").strip().upper() == key_upper for k in keys):
        return "artifact_key"
    cs = (row.commit_sha or "").lower()
    if cs and cs in shas_lower:
        return "commit_sha"
    return "artifact_key" if key_upper else "commit_sha"


@dataclass(frozen=True)
class GetArtifactTraceabilitySummary(Query):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    artifact_id: uuid.UUID


class GetArtifactTraceabilitySummaryHandler(QueryHandler[ArtifactTraceabilitySummaryDTO]):
    def __init__(
        self,
        session: AsyncSession,
        project_repo: ProjectRepository,
        artifact_repo: ArtifactRepository,
    ) -> None:
        self._session = session
        self._project_repo = project_repo
        self._artifact_repo = artifact_repo

    async def handle(self, query: Query) -> ArtifactTraceabilitySummaryDTO:
        assert isinstance(query, GetArtifactTraceabilitySummary)

        project = await self._project_repo.find_by_id(query.project_id)
        if project is None or project.tenant_id != query.tenant_id:
            raise ValidationError("Project not found")

        artifact = await self._artifact_repo.find_by_id(query.artifact_id)
        if artifact is None or artifact.project_id != query.project_id:
            raise ValidationError("Artifact not found")

        artifact_key = (artifact.artifact_key or "").strip() or None
        key_upper = artifact_key.upper() if artifact_key else None

        scm_repo = SqlAlchemyScmLinkRepository(self._session)
        scm_entities = await scm_repo.list_by_artifact(query.artifact_id)
        scm_links = [
            ScmLinkSummaryItemDTO(
                web_url=link.web_url,
                commit_sha=link.commit_sha,
                provider=link.provider,
                title=link.title,
                key_match_source=link.key_match_source,
            )
            for link in scm_entities
        ]
        shas_lower: set[str] = set()
        for link in scm_entities:
            if link.commit_sha:
                shas_lower.add(link.commit_sha.lower()[:64])

        conditions = []
        if artifact_key:
            key_variants = {artifact_key, artifact_key.upper(), artifact_key.lower()}
            conditions.append(
                or_(*[DeploymentEventModel.artifact_keys.contains([v]) for v in key_variants]),
            )
        if shas_lower:
            conditions.append(DeploymentEventModel.commit_sha.in_(shas_lower))

        env_rows: list[EnvironmentDeploySummaryDTO] = []
        if conditions:
            q = (
                select(DeploymentEventModel)
                .where(
                    DeploymentEventModel.project_id == query.project_id,
                    or_(*conditions),
                )
                .order_by(DeploymentEventModel.occurred_at.desc())
            )
            r = await self._session.execute(q)
            all_events = list(r.scalars().all())
            seen_env: set[str] = set()
            for m in all_events:
                if m.environment in seen_env:
                    continue
                seen_env.add(m.environment)
                via = _matched_via(
                    artifact_key=artifact_key,
                    key_upper=key_upper,
                    shas_lower=shas_lower,
                    row=m,
                )
                env_rows.append(
                    EnvironmentDeploySummaryDTO(
                        environment=m.environment,
                        last_occurred_at=m.occurred_at.isoformat(),
                        commit_sha=m.commit_sha,
                        image_digest=m.image_digest,
                        release_label=m.release_label,
                        build_id=m.build_id,
                        source=m.source,
                        matched_via=via,
                        deployment_event_id=m.id,
                    )
                )

        return ArtifactTraceabilitySummaryDTO(
            artifact_id=artifact.id,
            artifact_key=artifact_key,
            environments=env_rows,
            scm_links=scm_links,
        )

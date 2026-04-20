"""SCM link SQLAlchemy repository."""

from __future__ import annotations

import uuid

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from alm.scm.domain.entities import ScmLink
from alm.scm.domain.ports import ScmLinkRepository
from alm.scm.infrastructure.models import ScmLinkModel


class SqlAlchemyScmLinkRepository(ScmLinkRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def find_by_id(self, link_id: uuid.UUID) -> ScmLink | None:
        result = await self._session.execute(select(ScmLinkModel).where(ScmLinkModel.id == link_id))
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def list_by_artifact(
        self,
        artifact_id: uuid.UUID,
        *,
        task_id: uuid.UUID | None = None,
    ) -> list[ScmLink]:
        q = select(ScmLinkModel).where(ScmLinkModel.artifact_id == artifact_id)
        if task_id is not None:
            q = q.where(ScmLinkModel.task_id == task_id)
        q = q.order_by(ScmLinkModel.created_at.desc())
        result = await self._session.execute(q)
        return [self._to_entity(m) for m in result.scalars().all()]

    async def add(self, link: ScmLink) -> ScmLink:
        model = ScmLinkModel(
            id=link.id,
            project_id=link.project_id,
            artifact_id=link.artifact_id,
            task_id=link.task_id,
            provider=link.provider,
            repo_full_name=link.repo_full_name,
            ref=link.ref,
            commit_sha=link.commit_sha,
            pull_request_number=link.pull_request_number,
            title=link.title,
            web_url=link.web_url,
            source=link.source,
            key_match_source=link.key_match_source,
            created_by=link.created_by,
        )
        self._session.add(model)
        try:
            await self._session.flush()
            await self._session.refresh(model)
        except IntegrityError:
            await self._session.rollback()
            raise
        return SqlAlchemyScmLinkRepository._to_entity(model)

    async def delete(self, link_id: uuid.UUID) -> bool:
        result = await self._session.execute(delete(ScmLinkModel).where(ScmLinkModel.id == link_id))
        return result.rowcount > 0

    @staticmethod
    def _to_entity(m: ScmLinkModel) -> ScmLink:
        return ScmLink(
            id=m.id,
            project_id=m.project_id,
            artifact_id=m.artifact_id,
            task_id=m.task_id,
            provider=m.provider,
            repo_full_name=m.repo_full_name,
            ref=m.ref,
            commit_sha=m.commit_sha,
            pull_request_number=m.pull_request_number,
            title=m.title,
            web_url=m.web_url,
            source=m.source,
            key_match_source=m.key_match_source,
            created_by=m.created_by,
            created_at=m.created_at,
            updated_at=m.updated_at,
        )

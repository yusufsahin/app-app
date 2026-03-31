"""ArtifactLink SQLAlchemy repository."""

from __future__ import annotations

import uuid

from sqlalchemy import and_, func, or_, select, union_all, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from alm.artifact.infrastructure.models import ArtifactModel
from alm.artifact_link.domain.entities import ArtifactLink
from alm.artifact_link.domain.ports import ArtifactLinkRepository
from alm.artifact_link.infrastructure.models import ArtifactLinkModel


class SqlAlchemyArtifactLinkRepository(ArtifactLinkRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def find_by_id(self, link_id: uuid.UUID) -> ArtifactLink | None:
        result = await self._session.execute(select(ArtifactLinkModel).where(ArtifactLinkModel.id == link_id))
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def list_by_artifact(
        self,
        project_id: uuid.UUID,
        artifact_id: uuid.UUID,
    ) -> list[ArtifactLink]:
        result = await self._session.execute(
            select(ArtifactLinkModel).where(
                ArtifactLinkModel.project_id == project_id,
                or_(
                    ArtifactLinkModel.from_artifact_id == artifact_id,
                    ArtifactLinkModel.to_artifact_id == artifact_id,
                ),
            )
        )
        rows = list(result.scalars().all())
        outgoing = [m for m in rows if m.from_artifact_id == artifact_id]
        incoming = [m for m in rows if m.to_artifact_id == artifact_id]

        def _outgoing_key(m: ArtifactLinkModel) -> tuple:
            so = m.sort_order
            return (so is None, so if so is not None else 0, m.created_at.timestamp() if m.created_at else 0.0)

        outgoing.sort(key=_outgoing_key)
        incoming.sort(key=lambda m: m.created_at.timestamp() if m.created_at else 0.0, reverse=True)
        return [self._to_entity(m) for m in outgoing + incoming]

    async def add(self, link: ArtifactLink) -> ArtifactLink:
        model = ArtifactLinkModel(
            id=link.id,
            project_id=link.project_id,
            from_artifact_id=link.from_artifact_id,
            to_artifact_id=link.to_artifact_id,
            link_type=link.link_type,
            sort_order=link.sort_order,
        )
        self._session.add(model)
        await self._session.flush()
        return link

    async def delete(self, link_id: uuid.UUID) -> bool:
        result = await self._session.execute(select(ArtifactLinkModel).where(ArtifactLinkModel.id == link_id))
        model = result.scalar_one_or_none()
        if model is None:
            return False
        await self._session.delete(model)
        await self._session.flush()
        return True

    async def max_sort_order_for_outgoing(
        self,
        project_id: uuid.UUID,
        from_artifact_id: uuid.UUID,
        link_type: str,
    ) -> int | None:
        result = await self._session.execute(
            select(func.max(ArtifactLinkModel.sort_order)).where(
                and_(
                    ArtifactLinkModel.project_id == project_id,
                    ArtifactLinkModel.from_artifact_id == from_artifact_id,
                    ArtifactLinkModel.link_type == link_type,
                )
            )
        )
        return result.scalar_one()

    async def list_outgoing_link_ids(
        self,
        project_id: uuid.UUID,
        from_artifact_id: uuid.UUID,
        link_type: str,
    ) -> list[uuid.UUID]:
        result = await self._session.execute(
            select(ArtifactLinkModel.id)
            .where(
                and_(
                    ArtifactLinkModel.project_id == project_id,
                    ArtifactLinkModel.from_artifact_id == from_artifact_id,
                    ArtifactLinkModel.link_type == link_type,
                )
            )
            .order_by(
                ArtifactLinkModel.sort_order.asc().nulls_last(),
                ArtifactLinkModel.created_at.asc(),
            )
        )
        return [row[0] for row in result.all()]

    async def set_sort_orders_for_outgoing(
        self,
        project_id: uuid.UUID,
        from_artifact_id: uuid.UUID,
        link_type: str,
        ordered_link_ids: list[uuid.UUID],
    ) -> None:
        for idx, lid in enumerate(ordered_link_ids):
            await self._session.execute(
                update(ArtifactLinkModel)
                .where(
                    and_(
                        ArtifactLinkModel.id == lid,
                        ArtifactLinkModel.project_id == project_id,
                        ArtifactLinkModel.from_artifact_id == from_artifact_id,
                        ArtifactLinkModel.link_type == link_type,
                    )
                )
                .values(sort_order=idx)
            )
        await self._session.flush()

    async def exists(
        self,
        from_artifact_id: uuid.UUID,
        to_artifact_id: uuid.UUID,
        link_type: str,
    ) -> bool:
        result = await self._session.execute(
            select(ArtifactLinkModel.id)
            .where(
                and_(
                    ArtifactLinkModel.from_artifact_id == from_artifact_id,
                    ArtifactLinkModel.to_artifact_id == to_artifact_id,
                    ArtifactLinkModel.link_type == link_type,
                )
            )
            .limit(1)
        )
        return result.scalar_one_or_none() is not None

    async def list_candidate_run_test_pairs(
        self,
        project_id: uuid.UUID,
        test_ids: list[uuid.UUID],
    ) -> list[tuple[uuid.UUID, uuid.UUID]]:
        if not test_ids:
            return []
        suite_includes = aliased(ArtifactLinkModel)
        run_for_suite = aliased(ArtifactLinkModel)
        q_suite = (
            select(run_for_suite.from_artifact_id, suite_includes.to_artifact_id)
            .select_from(suite_includes)
            .join(
                run_for_suite,
                and_(
                    run_for_suite.project_id == suite_includes.project_id,
                    run_for_suite.to_artifact_id == suite_includes.from_artifact_id,
                    run_for_suite.link_type == "run_for_suite",
                ),
            )
            .join(ArtifactModel, ArtifactModel.id == run_for_suite.from_artifact_id)
            .where(
                suite_includes.project_id == project_id,
                suite_includes.link_type == "suite_includes_test",
                suite_includes.to_artifact_id.in_(test_ids),
                ArtifactModel.project_id == project_id,
                ArtifactModel.artifact_type == "test-run",
                ArtifactModel.deleted_at.is_(None),
            )
            .distinct()
        )
        direct_link = aliased(ArtifactLinkModel)
        run_art = aliased(ArtifactModel)
        target_art = aliased(ArtifactModel)
        q_direct = (
            select(direct_link.from_artifact_id, direct_link.to_artifact_id)
            .select_from(direct_link)
            .join(run_art, run_art.id == direct_link.from_artifact_id)
            .join(target_art, target_art.id == direct_link.to_artifact_id)
            .where(
                direct_link.project_id == project_id,
                direct_link.to_artifact_id.in_(test_ids),
                run_art.artifact_type == "test-run",
                target_art.artifact_type == "test-case",
                run_art.project_id == project_id,
                run_art.deleted_at.is_(None),
            )
            .distinct()
        )
        result = await self._session.execute(union_all(q_suite, q_direct))
        return [(row[0], row[1]) for row in result.all()]

    async def list_outgoing_links_from_artifacts(
        self,
        project_id: uuid.UUID,
        from_artifact_ids: list[uuid.UUID],
    ) -> list[ArtifactLink]:
        if not from_artifact_ids:
            return []
        result = await self._session.execute(
            select(ArtifactLinkModel).where(
                ArtifactLinkModel.project_id == project_id,
                ArtifactLinkModel.from_artifact_id.in_(from_artifact_ids),
            )
        )
        return [self._to_entity(m) for m in result.scalars().all()]

    async def list_suite_includes_tests_for_suites(
        self,
        project_id: uuid.UUID,
        suite_ids: list[uuid.UUID],
    ) -> list[ArtifactLink]:
        if not suite_ids:
            return []
        result = await self._session.execute(
            select(ArtifactLinkModel).where(
                ArtifactLinkModel.project_id == project_id,
                ArtifactLinkModel.from_artifact_id.in_(suite_ids),
                ArtifactLinkModel.link_type == "suite_includes_test",
            )
        )
        return [self._to_entity(m) for m in result.scalars().all()]

    async def list_links_to_artifacts(
        self,
        project_id: uuid.UUID,
        to_artifact_ids: list[uuid.UUID],
        link_types: list[str],
    ) -> list[ArtifactLink]:
        if not to_artifact_ids or not link_types:
            return []
        result = await self._session.execute(
            select(ArtifactLinkModel).where(
                ArtifactLinkModel.project_id == project_id,
                ArtifactLinkModel.to_artifact_id.in_(to_artifact_ids),
                ArtifactLinkModel.link_type.in_(link_types),
            )
        )
        return [self._to_entity(m) for m in result.scalars().all()]

    async def list_run_ids_for_suite_targets(
        self,
        project_id: uuid.UUID,
        suite_ids: list[uuid.UUID],
    ) -> list[uuid.UUID]:
        if not suite_ids:
            return []
        result = await self._session.execute(
            select(ArtifactLinkModel.from_artifact_id)
            .where(
                ArtifactLinkModel.project_id == project_id,
                ArtifactLinkModel.to_artifact_id.in_(suite_ids),
                ArtifactLinkModel.link_type == "run_for_suite",
            )
            .distinct()
        )
        return [row[0] for row in result.all()]

    @staticmethod
    def _to_entity(m: ArtifactLinkModel) -> ArtifactLink:
        return ArtifactLink(
            id=m.id,
            project_id=m.project_id,
            from_artifact_id=m.from_artifact_id,
            to_artifact_id=m.to_artifact_id,
            link_type=m.link_type,
            created_at=m.created_at,
            sort_order=m.sort_order,
        )

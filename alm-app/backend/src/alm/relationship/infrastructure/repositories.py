"""Relationship SQLAlchemy repository."""

from __future__ import annotations

import uuid

from sqlalchemy import and_, func, or_, select, union_all, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from alm.artifact.infrastructure.models import ArtifactModel
from alm.relationship.domain.entities import Relationship
from alm.relationship.domain.ports import RelationshipRepository
from alm.relationship.infrastructure.models import RelationshipModel


class SqlAlchemyRelationshipRepository(RelationshipRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def find_by_id(self, relationship_id: uuid.UUID) -> Relationship | None:
        result = await self._session.execute(select(RelationshipModel).where(RelationshipModel.id == relationship_id))
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def list_by_artifact(
        self,
        project_id: uuid.UUID,
        artifact_id: uuid.UUID,
    ) -> list[Relationship]:
        result = await self._session.execute(
            select(RelationshipModel).where(
                RelationshipModel.project_id == project_id,
                or_(
                    RelationshipModel.source_artifact_id == artifact_id,
                    RelationshipModel.target_artifact_id == artifact_id,
                ),
            )
        )
        rows = list(result.scalars().all())
        outgoing = [m for m in rows if m.source_artifact_id == artifact_id]
        incoming = [m for m in rows if m.target_artifact_id == artifact_id]

        def _outgoing_key(m: RelationshipModel) -> tuple:
            so = m.sort_order
            return (so is None, so if so is not None else 0, m.created_at.timestamp() if m.created_at else 0.0)

        outgoing.sort(key=_outgoing_key)
        incoming.sort(key=lambda m: m.created_at.timestamp() if m.created_at else 0.0, reverse=True)
        return [self._to_entity(m) for m in outgoing + incoming]

    async def add(self, relationship: Relationship) -> Relationship:
        model = RelationshipModel(
            id=relationship.id,
            project_id=relationship.project_id,
            source_artifact_id=relationship.source_artifact_id,
            target_artifact_id=relationship.target_artifact_id,
            relationship_type=relationship.relationship_type,
            sort_order=relationship.sort_order,
        )
        self._session.add(model)
        await self._session.flush()
        return relationship

    async def delete(self, relationship_id: uuid.UUID) -> bool:
        result = await self._session.execute(select(RelationshipModel).where(RelationshipModel.id == relationship_id))
        model = result.scalar_one_or_none()
        if model is None:
            return False
        await self._session.delete(model)
        await self._session.flush()
        return True

    async def max_sort_order_for_outgoing(
        self,
        project_id: uuid.UUID,
        source_artifact_id: uuid.UUID,
        relationship_type: str,
    ) -> int | None:
        result = await self._session.execute(
            select(func.max(RelationshipModel.sort_order)).where(
                and_(
                    RelationshipModel.project_id == project_id,
                    RelationshipModel.source_artifact_id == source_artifact_id,
                    RelationshipModel.relationship_type == relationship_type,
                )
            )
        )
        return result.scalar_one()

    async def list_outgoing_relationship_ids(
        self,
        project_id: uuid.UUID,
        source_artifact_id: uuid.UUID,
        relationship_type: str,
    ) -> list[uuid.UUID]:
        result = await self._session.execute(
            select(RelationshipModel.id)
            .where(
                and_(
                    RelationshipModel.project_id == project_id,
                    RelationshipModel.source_artifact_id == source_artifact_id,
                    RelationshipModel.relationship_type == relationship_type,
                )
            )
            .order_by(
                RelationshipModel.sort_order.asc().nulls_last(),
                RelationshipModel.created_at.asc(),
            )
        )
        return [row[0] for row in result.all()]

    async def set_sort_orders_for_outgoing(
        self,
        project_id: uuid.UUID,
        source_artifact_id: uuid.UUID,
        relationship_type: str,
        ordered_relationship_ids: list[uuid.UUID],
    ) -> None:
        for idx, relationship_id in enumerate(ordered_relationship_ids):
            await self._session.execute(
                update(RelationshipModel)
                .where(
                    and_(
                        RelationshipModel.id == relationship_id,
                        RelationshipModel.project_id == project_id,
                        RelationshipModel.source_artifact_id == source_artifact_id,
                        RelationshipModel.relationship_type == relationship_type,
                    )
                )
                .values(sort_order=idx)
            )
        await self._session.flush()

    async def exists(
        self,
        source_artifact_id: uuid.UUID,
        target_artifact_id: uuid.UUID,
        relationship_type: str,
    ) -> bool:
        result = await self._session.execute(
            select(RelationshipModel.id)
            .where(
                and_(
                    RelationshipModel.source_artifact_id == source_artifact_id,
                    RelationshipModel.target_artifact_id == target_artifact_id,
                    RelationshipModel.relationship_type == relationship_type,
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
        suite_includes = aliased(RelationshipModel)
        run_for_suite = aliased(RelationshipModel)
        q_suite = (
            select(run_for_suite.source_artifact_id, suite_includes.target_artifact_id)
            .select_from(suite_includes)
            .join(
                run_for_suite,
                and_(
                    run_for_suite.project_id == suite_includes.project_id,
                    run_for_suite.target_artifact_id == suite_includes.source_artifact_id,
                    run_for_suite.relationship_type == "run_for_suite",
                ),
            )
            .join(ArtifactModel, ArtifactModel.id == run_for_suite.source_artifact_id)
            .where(
                suite_includes.project_id == project_id,
                suite_includes.relationship_type == "suite_includes_test",
                suite_includes.target_artifact_id.in_(test_ids),
                ArtifactModel.project_id == project_id,
                ArtifactModel.artifact_type == "test-run",
                ArtifactModel.deleted_at.is_(None),
            )
            .distinct()
        )
        direct_link = aliased(RelationshipModel)
        run_art = aliased(ArtifactModel)
        target_art = aliased(ArtifactModel)
        q_direct = (
            select(direct_link.source_artifact_id, direct_link.target_artifact_id)
            .select_from(direct_link)
            .join(run_art, run_art.id == direct_link.source_artifact_id)
            .join(target_art, target_art.id == direct_link.target_artifact_id)
            .where(
                direct_link.project_id == project_id,
                direct_link.target_artifact_id.in_(test_ids),
                run_art.artifact_type == "test-run",
                target_art.artifact_type == "test-case",
                run_art.project_id == project_id,
                run_art.deleted_at.is_(None),
            )
            .distinct()
        )
        result = await self._session.execute(union_all(q_suite, q_direct))
        return [(row[0], row[1]) for row in result.all()]

    async def list_outgoing_relationships_from_artifacts(
        self,
        project_id: uuid.UUID,
        source_artifact_ids: list[uuid.UUID],
    ) -> list[Relationship]:
        if not source_artifact_ids:
            return []
        result = await self._session.execute(
            select(RelationshipModel).where(
                RelationshipModel.project_id == project_id,
                RelationshipModel.source_artifact_id.in_(source_artifact_ids),
            )
        )
        return [self._to_entity(m) for m in result.scalars().all()]

    async def list_suite_includes_tests_for_suites(
        self,
        project_id: uuid.UUID,
        suite_ids: list[uuid.UUID],
    ) -> list[Relationship]:
        if not suite_ids:
            return []
        result = await self._session.execute(
            select(RelationshipModel).where(
                RelationshipModel.project_id == project_id,
                RelationshipModel.source_artifact_id.in_(suite_ids),
                RelationshipModel.relationship_type == "suite_includes_test",
            )
        )
        return [self._to_entity(m) for m in result.scalars().all()]

    async def list_relationships_to_artifacts(
        self,
        project_id: uuid.UUID,
        target_artifact_ids: list[uuid.UUID],
        relationship_types: list[str],
    ) -> list[Relationship]:
        if not target_artifact_ids or not relationship_types:
            return []
        result = await self._session.execute(
            select(RelationshipModel).where(
                RelationshipModel.project_id == project_id,
                RelationshipModel.target_artifact_id.in_(target_artifact_ids),
                RelationshipModel.relationship_type.in_(relationship_types),
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
            select(RelationshipModel.source_artifact_id)
            .where(
                RelationshipModel.project_id == project_id,
                RelationshipModel.target_artifact_id.in_(suite_ids),
                RelationshipModel.relationship_type == "run_for_suite",
            )
            .distinct()
        )
        return [row[0] for row in result.all()]

    @staticmethod
    def _to_entity(model: RelationshipModel) -> Relationship:
        return Relationship(
            id=model.id,
            project_id=model.project_id,
            source_artifact_id=model.source_artifact_id,
            target_artifact_id=model.target_artifact_id,
            relationship_type=model.relationship_type,
            created_at=model.created_at,
            sort_order=model.sort_order,
        )

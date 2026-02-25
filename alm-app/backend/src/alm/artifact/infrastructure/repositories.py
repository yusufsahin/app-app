"""Artifact SQLAlchemy repository."""
from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import func, or_, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from alm.artifact.domain.entities import Artifact
from alm.artifact.domain.ports import ArtifactRepository

if TYPE_CHECKING:
    from alm.shared.domain.specification import Specification
from alm.artifact.infrastructure.models import ArtifactModel
from alm.shared.application.mediator import buffer_events
from alm.shared.audit.core import ChangeType
from alm.shared.audit.interceptor import buffer_audit


class SqlAlchemyArtifactRepository(ArtifactRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def find_by_id(self, artifact_id: uuid.UUID) -> Artifact | None:
        result = await self._session.execute(
            select(ArtifactModel).where(
                ArtifactModel.id == artifact_id,
                ArtifactModel.deleted_at.is_(None),
            )
        )
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def find_by_id_include_deleted(self, artifact_id: uuid.UUID) -> Artifact | None:
        result = await self._session.execute(
            select(ArtifactModel).where(ArtifactModel.id == artifact_id)
        )
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    _SORT_COLUMNS = {
        "artifact_key": "artifact_key",
        "title": "title",
        "state": "state",
        "artifact_type": "artifact_type",
        "created_at": "created_at",
        "updated_at": "updated_at",
    }

    def _list_by_project_filters(
        self,
        q,
        state_filter: str | None,
        type_filter: str | None,
        search_query: str | None,
        cycle_node_id: uuid.UUID | None = None,
        area_node_id: uuid.UUID | None = None,
    ):
        """Apply common filters for list and count."""
        if state_filter:
            q = q.where(ArtifactModel.state == state_filter)
        if type_filter:
            q = q.where(ArtifactModel.artifact_type == type_filter)
        if cycle_node_id is not None:
            q = q.where(ArtifactModel.cycle_node_id == cycle_node_id)
        if area_node_id is not None:
            q = q.where(ArtifactModel.area_node_id == area_node_id)
        if search_query and search_query.strip():
            term = search_query.strip()
            # Full-text search on search_vector (tsvector); fallback to ILIKE if no FTS match
            q = q.where(
                text("artifacts.search_vector @@ plainto_tsquery('english', :search_fts)").bindparams(
                    search_fts=term
                )
            )
        return q

    async def count_by_project(
        self,
        project_id: uuid.UUID,
        state_filter: str | None = None,
        type_filter: str | None = None,
        search_query: str | None = None,
        cycle_node_id: uuid.UUID | None = None,
        area_node_id: uuid.UUID | None = None,
        include_deleted: bool = False,
    ) -> int:
        q = select(func.count(ArtifactModel.id)).where(
            ArtifactModel.project_id == project_id,
            ArtifactModel.deleted_at.is_(None) if not include_deleted else ArtifactModel.deleted_at.isnot(None),
        )
        q = self._list_by_project_filters(
            q, state_filter, type_filter, search_query, cycle_node_id, area_node_id
        )
        result = await self._session.execute(q)
        return result.scalar_one() or 0

    async def list_by_project(
        self,
        project_id: uuid.UUID,
        state_filter: str | None = None,
        type_filter: str | None = None,
        search_query: str | None = None,
        cycle_node_id: uuid.UUID | None = None,
        area_node_id: uuid.UUID | None = None,
        sort_by: str | None = None,
        sort_order: str | None = None,
        limit: int | None = None,
        offset: int | None = None,
        include_deleted: bool = False,
    ) -> list[Artifact]:
        q = select(ArtifactModel).where(
            ArtifactModel.project_id == project_id,
            ArtifactModel.deleted_at.is_(None) if not include_deleted else ArtifactModel.deleted_at.isnot(None),
        )
        q = self._list_by_project_filters(
            q, state_filter, type_filter, search_query, cycle_node_id, area_node_id
        )
        column_name = self._SORT_COLUMNS.get(sort_by) if sort_by else "created_at"
        order_asc = (sort_order or "desc").lower() == "asc"
        column = getattr(ArtifactModel, column_name, None)
        if column is not None:
            q = q.order_by(column.asc() if order_asc else column.desc())
        else:
            q = q.order_by(ArtifactModel.created_at.desc())
        if offset is not None:
            q = q.offset(offset)
        if limit is not None:
            q = q.limit(limit)
        result = await self._session.execute(q)
        return [self._to_entity(m) for m in result.scalars().all()]

    async def count_by_project_ids(self, project_ids: list[uuid.UUID]) -> int:
        if not project_ids:
            return 0
        result = await self._session.execute(
            select(func.count(ArtifactModel.id)).where(
                ArtifactModel.project_id.in_(project_ids),
                ArtifactModel.deleted_at.is_(None),
            )
        )
        return result.scalar_one() or 0

    async def count_open_defects_by_project_ids(
        self, project_ids: list[uuid.UUID]
    ) -> int:
        if not project_ids:
            return 0
        result = await self._session.execute(
            select(func.count(ArtifactModel.id)).where(
                ArtifactModel.project_id.in_(project_ids),
                ArtifactModel.deleted_at.is_(None),
                ArtifactModel.artifact_type.in_(["defect", "bug"]),
                ArtifactModel.state.notin_(["closed", "done"]),
            )
        )
        return result.scalar_one() or 0

    async def count_tasks_by_project_ids(self, project_ids: list[uuid.UUID]) -> int:
        if not project_ids:
            return 0
        result = await self._session.execute(
            select(func.count(ArtifactModel.id)).where(
                ArtifactModel.project_id.in_(project_ids),
                ArtifactModel.deleted_at.is_(None),
                ArtifactModel.artifact_type.in_(["task", "requirement"]),
            )
        )
        return result.scalar_one() or 0

    async def list_recent_by_project_ids(
        self, project_ids: list[uuid.UUID], limit: int = 20
    ) -> list[tuple[uuid.UUID, uuid.UUID, str, str, str, object]]:
        if not project_ids:
            return []
        q = (
            select(
                ArtifactModel.id,
                ArtifactModel.project_id,
                ArtifactModel.title,
                ArtifactModel.state,
                ArtifactModel.artifact_type,
                ArtifactModel.updated_at,
            )
            .where(
                ArtifactModel.project_id.in_(project_ids),
                ArtifactModel.deleted_at.is_(None),
            )
            .order_by(ArtifactModel.updated_at.desc().nullslast())
            .limit(limit)
        )
        result = await self._session.execute(q)
        return [(r[0], r[1], r[2], r[3], r[4], r[5]) for r in result.all()]

    async def list_by_spec(
        self, spec: "Specification[Artifact]"
    ) -> list[Artifact]:
        """List artifacts satisfying specification. Fetches all non-deleted, then filters in-memory."""
        q = select(ArtifactModel).where(ArtifactModel.deleted_at.is_(None))
        result = await self._session.execute(q)
        entities = [self._to_entity(m) for m in result.scalars().all()]
        return [e for e in entities if spec.is_satisfied_by(e)]

    async def add(self, artifact: Artifact) -> Artifact:
        model = ArtifactModel(
            id=artifact.id,
            project_id=artifact.project_id,
            artifact_type=artifact.artifact_type,
            title=artifact.title,
            description=artifact.description,
            state=artifact.state,
            assignee_id=artifact.assignee_id,
            parent_id=artifact.parent_id,
            custom_fields=artifact.custom_fields or {},
            artifact_key=artifact.artifact_key,
            state_reason=artifact.state_reason,
            resolution=artifact.resolution,
            rank_order=artifact.rank_order,
            cycle_node_id=artifact.cycle_node_id,
            area_node_id=artifact.area_node_id,
            area_path_snapshot=artifact.area_path_snapshot,
        )
        self._session.add(model)
        await self._session.flush()
        await self._session.refresh(model)
        artifact.created_at = model.created_at
        artifact.updated_at = model.updated_at
        buffer_events(self._session, artifact.collect_events())
        buffer_audit(
            self._session,
            "Artifact",
            artifact.id,
            artifact.to_snapshot_dict(),
            ChangeType.INITIAL,
        )
        return artifact

    async def update(self, artifact: Artifact) -> Artifact:
        values: dict = {
            "title": artifact.title,
            "description": artifact.description,
            "state": artifact.state,
            "assignee_id": artifact.assignee_id,
            "parent_id": artifact.parent_id,
            "custom_fields": artifact.custom_fields or {},
            "artifact_key": artifact.artifact_key,
            "state_reason": artifact.state_reason,
            "resolution": artifact.resolution,
            "rank_order": artifact.rank_order,
            "cycle_node_id": artifact.cycle_node_id,
            "area_node_id": artifact.area_node_id,
            "area_path_snapshot": artifact.area_path_snapshot,
        }
        if hasattr(artifact, "deleted_at"):
            values["deleted_at"] = artifact.deleted_at
        if hasattr(artifact, "deleted_by"):
            values["deleted_by"] = artifact.deleted_by
        await self._session.execute(
            update(ArtifactModel).where(ArtifactModel.id == artifact.id).values(**values)
        )
        await self._session.flush()
        result = await self._session.execute(
            select(ArtifactModel).where(ArtifactModel.id == artifact.id)
        )
        refreshed = result.scalar_one_or_none()
        if refreshed is not None:
            artifact.created_at = refreshed.created_at
            artifact.updated_at = refreshed.updated_at
        buffer_events(self._session, artifact.collect_events())
        buffer_audit(
            self._session,
            "Artifact",
            artifact.id,
            artifact.to_snapshot_dict(),
            ChangeType.UPDATE,
        )
        return artifact

    @staticmethod
    def _to_entity(m: ArtifactModel) -> Artifact:
        entity = Artifact(
            id=m.id,
            project_id=m.project_id,
            artifact_type=m.artifact_type,
            title=m.title,
            description=m.description or "",
            state=m.state,
            assignee_id=m.assignee_id,
            parent_id=m.parent_id,
            custom_fields=getattr(m, "custom_fields", None) or {},
            artifact_key=getattr(m, "artifact_key", None),
            state_reason=getattr(m, "state_reason", None),
            resolution=getattr(m, "resolution", None),
            rank_order=getattr(m, "rank_order", None),
            cycle_node_id=getattr(m, "cycle_node_id", None),
            area_node_id=getattr(m, "area_node_id", None),
            area_path_snapshot=getattr(m, "area_path_snapshot", None),
            created_at=getattr(m, "created_at", None),
            updated_at=getattr(m, "updated_at", None),
        )
        entity.deleted_at = getattr(m, "deleted_at", None)
        entity.deleted_by = getattr(m, "deleted_by", None)
        return entity

    async def sum_effort_by_cycles(
        self,
        project_id: uuid.UUID,
        cycle_node_ids: list[uuid.UUID],
        done_states: tuple[str, ...],
        effort_field: str,
    ) -> list[tuple[uuid.UUID, float]]:
        """Sum effort from custom_fields[effort_field] per cycle (artifacts in done_states)."""
        if not cycle_node_ids or not done_states:
            return []
        totals: dict[uuid.UUID, float] = {c: 0.0 for c in cycle_node_ids}
        for cid in cycle_node_ids:
            artifacts = await self.list_by_project(
                project_id,
                state_filter=None,
                cycle_node_id=cid,
                limit=5000,
                include_deleted=False,
            )
            for a in artifacts:
                if a.state not in done_states:
                    continue
                cf = a.custom_fields or {}
                val = cf.get(effort_field)
                if val is not None:
                    try:
                        totals[cid] += float(val)
                    except (TypeError, ValueError):
                        pass
        return [(cid, totals[cid]) for cid in cycle_node_ids]

    async def sum_total_effort_by_cycles(
        self,
        project_id: uuid.UUID,
        cycle_node_ids: list[uuid.UUID],
        effort_field: str,
    ) -> list[tuple[uuid.UUID, float]]:
        """Sum effort from custom_fields[effort_field] per cycle (all artifacts in cycle)."""
        if not cycle_node_ids:
            return []
        totals: dict[uuid.UUID, float] = {c: 0.0 for c in cycle_node_ids}
        for cid in cycle_node_ids:
            artifacts = await self.list_by_project(
                project_id,
                state_filter=None,
                cycle_node_id=cid,
                limit=5000,
                include_deleted=False,
            )
            for a in artifacts:
                cf = a.custom_fields or {}
                val = cf.get(effort_field)
                if val is not None:
                    try:
                        totals[cid] += float(val)
                    except (TypeError, ValueError):
                        pass
        return [(cid, totals[cid]) for cid in cycle_node_ids]

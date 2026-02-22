"""
SQLAlchemy event-based soft delete filter.
Automatically appends WHERE deleted_at IS NULL to queries on soft-deletable models.
"""

from __future__ import annotations

from sqlalchemy import event
from sqlalchemy.orm import Query

from alm.shared.infrastructure.db.base_model import SoftDeleteMixin


@event.listens_for(Query, "before_compile", retval=True)
def _apply_soft_delete_filter(query: Query) -> Query:
    for desc in query.column_descriptions:
        entity = desc.get("entity")
        if entity is None:
            continue
        if hasattr(entity, "deleted_at") and issubclass(entity, SoftDeleteMixin):
            if not query._execution_options.get("include_deleted", False):
                query = query.filter(entity.deleted_at.is_(None))
    return query

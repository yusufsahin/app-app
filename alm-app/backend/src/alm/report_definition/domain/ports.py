from __future__ import annotations

import uuid
from typing import Protocol

from alm.report_definition.domain.entities import ReportDefinition


class ReportDefinitionRepository(Protocol):
    async def find_by_id(self, report_id: uuid.UUID) -> ReportDefinition | None: ...

    async def list_for_project(
        self,
        tenant_id: uuid.UUID,
        project_id: uuid.UUID,
        *,
        user_id: uuid.UUID,
    ) -> list[ReportDefinition]: ...

    async def add(self, entity: ReportDefinition) -> ReportDefinition: ...

    async def update(self, entity: ReportDefinition) -> ReportDefinition: ...

    async def delete(self, report_id: uuid.UUID) -> bool: ...

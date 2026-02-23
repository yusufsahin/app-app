from __future__ import annotations

import uuid

from alm.shared.domain.aggregate import AggregateRoot
from alm.project.domain.events import ProjectCreated


class Project(AggregateRoot):
    def __init__(
        self,
        tenant_id: uuid.UUID,
        name: str,
        slug: str,
        code: str,
        *,
        id: uuid.UUID | None = None,
        description: str = "",
        process_template_version_id: uuid.UUID | None = None,
    ) -> None:
        super().__init__(id=id)
        self.tenant_id = tenant_id
        self.name = name
        self.slug = slug
        self.code = code
        self.description = description
        self.process_template_version_id = process_template_version_id

    @classmethod
    def create(
        cls,
        tenant_id: uuid.UUID,
        name: str,
        slug: str,
        code: str,
        description: str = "",
    ) -> Project:
        project = cls(
            tenant_id=tenant_id,
            name=name,
            slug=slug,
            code=code,
            description=description,
        )
        project._register_event(
            ProjectCreated(
                tenant_id=tenant_id,
                project_id=project.id,
                name=name,
                slug=slug,
                code=code,
            )
        )
        return project

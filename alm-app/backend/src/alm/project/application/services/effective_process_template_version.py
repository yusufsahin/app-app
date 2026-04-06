"""Resolve the process template version used for manifest-driven behavior for a project row."""

from __future__ import annotations

import uuid

from alm.process_template.domain.entities import ProcessTemplateVersion
from alm.process_template.domain.ports import ProcessTemplateRepository


async def effective_process_template_version(
    process_template_repo: ProcessTemplateRepository,
    process_template_version_id: uuid.UUID | None,
) -> ProcessTemplateVersion | None:
    """Project FK first, then built-in default (``basic``), same as ``GetProjectManifestHandler``."""
    version: ProcessTemplateVersion | None = None
    if process_template_version_id is not None:
        version = await process_template_repo.find_version_by_id(process_template_version_id)
    if version is None:
        version = await process_template_repo.find_default_version()
    return version

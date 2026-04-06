"""GetProjectManifest: resolve manifest when project FK is missing or orphaned."""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from alm.project.application.queries.get_project_manifest import GetProjectManifest, GetProjectManifestHandler


@pytest.mark.asyncio
async def test_get_project_manifest_falls_back_when_stored_version_id_orphaned() -> None:
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    dead_version_id = uuid.uuid4()
    default_version_id = uuid.uuid4()
    template_id = uuid.uuid4()

    project = MagicMock(tenant_id=tenant_id, process_template_version_id=dead_version_id)
    project_repo = AsyncMock()
    project_repo.find_by_id = AsyncMock(return_value=project)

    default_version = MagicMock(
        id=default_version_id,
        template_id=template_id,
        version="1.0.0",
        manifest_bundle={"defs": []},
    )
    process_repo = AsyncMock()

    async def _find_version_by_id(vid: uuid.UUID):
        if vid == dead_version_id:
            return None
        if vid == default_version_id:
            return default_version
        return None

    process_repo.find_version_by_id = AsyncMock(side_effect=_find_version_by_id)
    process_repo.find_default_version = AsyncMock(return_value=default_version)
    process_repo.find_by_id = AsyncMock(return_value=MagicMock(name="Basic", slug="basic"))

    handler = GetProjectManifestHandler(project_repo, process_repo)
    result = await handler.handle(GetProjectManifest(tenant_id=tenant_id, project_id=project_id))

    assert result is not None
    assert result.template_slug == "basic"
    process_repo.find_default_version.assert_awaited()

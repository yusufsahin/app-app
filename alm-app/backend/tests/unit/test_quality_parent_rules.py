from __future__ import annotations

import uuid
from unittest.mock import AsyncMock

import pytest

from alm.artifact.application.commands.create_artifact import CreateArtifact, CreateArtifactHandler
from alm.artifact.application.commands.update_artifact import UpdateArtifact, UpdateArtifactHandler
from alm.artifact.domain.entities import Artifact
from alm.shared.domain.exceptions import ValidationError
from tests.support.manifests import QUALITY_PARENT_RULES_MANIFEST_BUNDLE
from tests.support.mocks import empty_project_tag_repo


@pytest.mark.asyncio
async def test_create_test_case_rejects_testsuite_folder_parent() -> None:
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    parent_id = uuid.uuid4()
    version_id = uuid.uuid4()

    project = AsyncMock(tenant_id=tenant_id, code="PRJ", process_template_version_id=version_id)
    version = AsyncMock(id=version_id, manifest_bundle=QUALITY_PARENT_RULES_MANIFEST_BUNDLE)
    parent = Artifact.create(
        project_id=project_id,
        artifact_type="testsuite-folder",
        title="Suites",
        state="Active",
        parent_id=None,
        artifact_key="PRJ-TSF1",
    )
    parent.id = parent_id

    artifact_repo = AsyncMock()
    artifact_repo.find_by_id = AsyncMock(return_value=parent)
    project_repo = AsyncMock()
    project_repo.find_by_id = AsyncMock(return_value=project)
    project_repo.increment_artifact_seq = AsyncMock(return_value=42)
    process_template_repo = AsyncMock()
    process_template_repo.find_version_by_id = AsyncMock(return_value=version)
    area_repo = AsyncMock()

    tag_repo = empty_project_tag_repo()
    handler = CreateArtifactHandler(
        artifact_repo=artifact_repo,
        project_repo=project_repo,
        process_template_repo=process_template_repo,
        area_repo=area_repo,
        tag_repo=tag_repo,
    )
    cmd = CreateArtifact(
        tenant_id=tenant_id,
        project_id=project_id,
        artifact_type="test-case",
        title="TC",
        parent_id=parent_id,
    )

    with pytest.raises(ValidationError) as exc:
        await handler.handle(cmd)
    detail = str(exc.value.detail)
    assert "testsuite-folder" in detail or "quality-folder" in detail


@pytest.mark.asyncio
async def test_update_test_case_reparent_rejects_testsuite_folder() -> None:
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    artifact_id = uuid.uuid4()
    parent_id = uuid.uuid4()
    version_id = uuid.uuid4()

    project = AsyncMock(tenant_id=tenant_id, process_template_version_id=version_id)
    version = AsyncMock(id=version_id, manifest_bundle=QUALITY_PARENT_RULES_MANIFEST_BUNDLE)
    artifact = Artifact.create(
        project_id=project_id,
        artifact_type="test-case",
        title="TC",
        state="new",
        parent_id=None,
        artifact_key="PRJ-1",
    )
    artifact.id = artifact_id
    bad_parent = Artifact.create(
        project_id=project_id,
        artifact_type="testsuite-folder",
        title="Suites",
        state="Active",
        parent_id=None,
        artifact_key="PRJ-TSF1",
    )
    bad_parent.id = parent_id

    artifact_repo = AsyncMock()

    async def _find_by_id(aid: uuid.UUID):
        if aid == artifact_id:
            return artifact
        if aid == parent_id:
            return bad_parent
        return None

    artifact_repo.find_by_id = AsyncMock(side_effect=_find_by_id)
    project_repo = AsyncMock()
    project_repo.find_by_id = AsyncMock(return_value=project)
    process_template_repo = AsyncMock()
    process_template_repo.find_version_by_id = AsyncMock(return_value=version)
    area_repo = AsyncMock()

    handler = UpdateArtifactHandler(
        artifact_repo=artifact_repo,
        project_repo=project_repo,
        area_repo=area_repo,
        process_template_repo=process_template_repo,
        tag_repo=empty_project_tag_repo(),
    )
    cmd = UpdateArtifact(
        tenant_id=tenant_id,
        project_id=project_id,
        artifact_id=artifact_id,
        updates={"parent_id": str(parent_id)},
    )

    with pytest.raises(ValidationError) as exc:
        await handler.handle(cmd)
    assert "quality-folder" in str(exc.value.detail)
    artifact_repo.update.assert_not_called()

"""Unit tests for dual-root model: root artifact constants and delete protection."""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock

import pytest

from alm.artifact.application.commands.delete_artifact import (
    DeleteArtifact,
    DeleteArtifactHandler,
)
from alm.artifact.domain.constants import ROOT_ARTIFACT_TYPES, is_root_artifact
from alm.artifact.domain.entities import Artifact
from alm.shared.domain.exceptions import ValidationError


def test_is_root_artifact():
    assert is_root_artifact("root-requirement") is True
    assert is_root_artifact("root-quality") is True
    assert is_root_artifact("root-defect") is True
    assert is_root_artifact("requirement") is False
    assert is_root_artifact("defect") is False
    assert is_root_artifact("epic") is False


def test_root_artifact_types_constant():
    assert "root-requirement" in ROOT_ARTIFACT_TYPES
    assert "root-quality" in ROOT_ARTIFACT_TYPES
    assert "root-defect" in ROOT_ARTIFACT_TYPES
    assert len(ROOT_ARTIFACT_TYPES) == 3


@pytest.mark.asyncio
async def test_delete_root_raises_validation_error():
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    root_id = uuid.uuid4()
    root = Artifact(
        project_id=project_id,
        artifact_type="root-requirement",
        title="Requirements",
        state="Active",
        id=root_id,
        artifact_key="PRJ-R0",
    )

    artifact_repo = AsyncMock()
    artifact_repo.find_by_id = AsyncMock(return_value=root)
    project_repo = AsyncMock()
    project_repo.find_by_id = AsyncMock(return_value=AsyncMock(tenant_id=tenant_id))

    handler = DeleteArtifactHandler(artifact_repo=artifact_repo, project_repo=project_repo)
    cmd = DeleteArtifact(tenant_id=tenant_id, project_id=project_id, artifact_id=root_id)

    with pytest.raises(ValidationError) as exc_info:
        await handler.handle(cmd)
    assert "root" in exc_info.value.detail.lower()

    artifact_repo.update.assert_not_called()

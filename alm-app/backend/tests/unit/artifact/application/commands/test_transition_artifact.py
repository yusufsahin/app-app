import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from tests.support.mocks import empty_project_tag_repo, simple_manifest_ast

from alm.artifact.application.commands.transition_artifact import TransitionArtifact, TransitionArtifactHandler
from alm.shared.domain.exceptions import ConflictError, ValidationError


@pytest.mark.asyncio
async def test_transition_artifact_not_found():
    # Arrange
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    artifact_repo = AsyncMock()
    artifact_repo.find_by_id.return_value = None

    project_repo = AsyncMock()
    project_repo.find_by_id.return_value = MagicMock(tenant_id=tenant_id)

    tag_repo = empty_project_tag_repo()
    handler = TransitionArtifactHandler(artifact_repo, project_repo, AsyncMock(), MagicMock(), tag_repo)
    command = TransitionArtifact(
        tenant_id=tenant_id,
        project_id=project_id,
        artifact_id=uuid.uuid4(),
        trigger="close",
    )

    # Act & Assert
    with pytest.raises(ValidationError, match="Artifact not found"):
        await handler.handle(command)


@pytest.mark.asyncio
async def test_transition_artifact_optimistic_locking_conflict():
    # Arrange
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    artifact_id = uuid.uuid4()

    now = datetime.now(UTC)
    artifact = MagicMock()
    artifact.project_id = project_id
    artifact.updated_at = now

    artifact_repo = AsyncMock()
    artifact_repo.find_by_id.return_value = artifact

    project = MagicMock(tenant_id=tenant_id, process_template_version_id=uuid.uuid4())
    project_repo = AsyncMock()
    project_repo.find_by_id.return_value = project

    process_template_repo = AsyncMock()
    process_template_repo.find_version_by_id.return_value = MagicMock(manifest_bundle={})

    tag_repo = empty_project_tag_repo()
    handler = TransitionArtifactHandler(artifact_repo, project_repo, process_template_repo, MagicMock(), tag_repo)

    # Client sends an old timestamp
    old_ts = "2020-01-01T00:00:00Z"
    command = TransitionArtifact(
        tenant_id=tenant_id,
        project_id=project_id,
        artifact_id=artifact_id,
        new_state="Done",
        expected_updated_at=old_ts
    )

    # Act & Assert
    with (
        patch("alm.artifact.application.commands.transition_artifact.get_manifest_ast", return_value=simple_manifest_ast()),
        pytest.raises(ConflictError, match="modified by someone else"),
    ):
        await handler.handle(command)


@pytest.mark.asyncio
async def test_transition_artifact_invalid_trigger():
    # Arrange
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    artifact_id = uuid.uuid4()

    artifact = MagicMock(project_id=project_id, state="Open", artifact_type="defect")
    artifact_repo = AsyncMock()
    artifact_repo.find_by_id.return_value = artifact

    project = MagicMock(tenant_id=tenant_id, process_template_version_id=uuid.uuid4())
    project_repo = AsyncMock()
    project_repo.find_by_id.return_value = project

    process_template_repo = AsyncMock()
    process_template_repo.find_version_by_id.return_value = MagicMock(manifest_bundle={})

    tag_repo = empty_project_tag_repo()
    handler = TransitionArtifactHandler(artifact_repo, project_repo, process_template_repo, MagicMock(), tag_repo)
    command = TransitionArtifact(
        tenant_id=tenant_id,
        project_id=project_id,
        artifact_id=artifact_id,
        trigger="invalid_trigger"
    )

    # Act & Assert
    with (
        patch("alm.artifact.application.commands.transition_artifact.get_manifest_ast", return_value=simple_manifest_ast()),
        patch("alm.artifact.application.commands.transition_artifact.get_permitted_triggers", return_value=[]),
        pytest.raises(ValidationError, match="is not permitted"),
    ):
        await handler.handle(command)

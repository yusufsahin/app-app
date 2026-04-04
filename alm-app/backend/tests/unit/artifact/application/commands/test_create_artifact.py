import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from alm.artifact.application.commands.create_artifact import CreateArtifact, CreateArtifactHandler
from tests.support.mocks import empty_project_tag_repo, simple_manifest_ast
from alm.shared.domain.exceptions import ValidationError


@pytest.mark.asyncio
async def test_create_artifact_success():
    # Arrange
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    parent_id = uuid.uuid4()

    project = MagicMock(tenant_id=tenant_id, code="PRJ", process_template_version_id=uuid.uuid4())
    project_repo = AsyncMock()
    project_repo.find_by_id.return_value = project
    project_repo.increment_artifact_seq.return_value = 101

    parent = MagicMock(id=parent_id, artifact_type="root-requirement", project_id=project_id)
    artifact_repo = AsyncMock()
    artifact_repo.add.side_effect = lambda a: a
    artifact_repo.find_by_id.return_value = parent

    process_template_repo = AsyncMock()
    process_template_repo.find_version_by_id.return_value = MagicMock(manifest_bundle={})

    area_repo = AsyncMock()
    tag_repo = empty_project_tag_repo()

    handler = CreateArtifactHandler(artifact_repo, project_repo, process_template_repo, area_repo, tag_repo)
    command = CreateArtifact(
        tenant_id=tenant_id,
        project_id=project_id,
        artifact_type="requirement",
        title="New Req",
        parent_id=parent_id,
    )

    # Act
    with patch("alm.artifact.application.commands.create_artifact.get_manifest_ast", return_value=simple_manifest_ast()):
        with patch("alm.artifact.application.commands.create_artifact.workflow_get_initial_state", return_value="Open"):
            with patch("alm.artifact.application.commands.create_artifact.is_valid_parent_child", return_value=True):
                result = await handler.handle(command)
    
    # Assert
    assert result.title == "New Req"
    assert result.artifact_key == "PRJ-101"
    assert result.parent_id == parent_id
    artifact_repo.add.assert_called()


@pytest.mark.asyncio
async def test_create_artifact_invalid_parent():
    # Arrange
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    parent_id = uuid.uuid4()
    
    project = MagicMock(tenant_id=tenant_id, process_template_version_id=uuid.uuid4())
    project_repo = AsyncMock()
    project_repo.find_by_id.return_value = project
    
    parent = MagicMock(artifact_type="defect", project_id=project_id)
    artifact_repo = AsyncMock()
    artifact_repo.find_by_id.return_value = parent
    
    process_template_repo = AsyncMock()
    process_template_repo.find_version_by_id.return_value = MagicMock(manifest_bundle={})
    
    tag_repo = empty_project_tag_repo()
    handler = CreateArtifactHandler(artifact_repo, project_repo, process_template_repo, AsyncMock(), tag_repo)
    command = CreateArtifact(
        tenant_id=tenant_id,
        project_id=project_id,
        artifact_type="task",
        title="Invalid Parent",
        parent_id=parent_id
    )
    
    # Act & Assert
    with patch("alm.artifact.application.commands.create_artifact.get_manifest_ast", return_value=simple_manifest_ast()):
        with patch("alm.artifact.application.commands.create_artifact.workflow_get_initial_state", return_value="Open"):
            with patch("alm.artifact.application.commands.create_artifact.is_valid_parent_child", return_value=False):
                with pytest.raises(ValidationError, match="cannot be child of"):
                    await handler.handle(command)


@pytest.mark.asyncio
async def test_create_defect_without_parent_resolves_root_defect():
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    root_defect_id = uuid.uuid4()

    project = MagicMock(tenant_id=tenant_id, code="PRJ", process_template_version_id=uuid.uuid4())
    project_repo = AsyncMock()
    project_repo.find_by_id.return_value = project
    project_repo.increment_artifact_seq.return_value = 42

    root_artifact = MagicMock(
        id=root_defect_id, artifact_type="root-defect", project_id=project_id
    )
    artifact_repo = AsyncMock()
    artifact_repo.add.side_effect = lambda a: a
    artifact_repo.list_by_project.return_value = [root_artifact]
    artifact_repo.find_by_id.return_value = root_artifact

    process_template_repo = AsyncMock()
    process_template_repo.find_version_by_id.return_value = MagicMock(manifest_bundle={"defs": []})

    tag_repo = empty_project_tag_repo()
    handler = CreateArtifactHandler(
        artifact_repo, project_repo, process_template_repo, AsyncMock(), tag_repo
    )
    command = CreateArtifact(
        tenant_id=tenant_id,
        project_id=project_id,
        artifact_type="defect",
        title="No parent sent",
        parent_id=None,
    )

    with patch(
        "alm.artifact.application.commands.create_artifact.get_manifest_ast",
        return_value=simple_manifest_ast(),
    ):
        with patch(
            "alm.artifact.application.commands.create_artifact.workflow_get_initial_state",
            return_value="new",
        ):
            with patch(
                "alm.artifact.application.commands.create_artifact.get_artifact_type_def",
                return_value={"parent_types": ["root-defect"]},
            ):
                with patch(
                    "alm.artifact.application.commands.create_artifact.is_valid_parent_child",
                    return_value=True,
                ):
                    result = await handler.handle(command)

    assert result.parent_id == root_defect_id
    created = artifact_repo.add.call_args[0][0]
    assert created.parent_id == root_defect_id
    artifact_repo.list_by_project.assert_awaited_once()

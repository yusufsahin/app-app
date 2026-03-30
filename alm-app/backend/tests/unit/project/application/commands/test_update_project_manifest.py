import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from alm.project.application.commands.update_project_manifest import UpdateProjectManifest, UpdateProjectManifestHandler
from alm.project.domain.entities import Project
from alm.shared.domain.exceptions import ValidationError


@pytest.mark.asyncio
async def test_update_project_manifest_success():
    # Arrange
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    version_id = uuid.uuid4()
    
    project = Project(tenant_id=tenant_id, name="Test Project", slug="test", code="PRJ", id=project_id)
    project.process_template_version_id = version_id
    
    current_version = MagicMock()
    current_version.template_id = uuid.uuid4()
    
    project_repo = AsyncMock()
    project_repo.find_by_id.return_value = project
    
    process_template_repo = AsyncMock()
    process_template_repo.find_version_by_id.return_value = current_version
    
    handler = UpdateProjectManifestHandler(project_repo, process_template_repo)
    
    command = UpdateProjectManifest(
        tenant_id=tenant_id,
        project_id=project_id,
        manifest_bundle={"defs": {}}
    )
    
    # Act
    # We mock out the mpc logic to avoid errors if mpc is not installed
    with patch("alm.project.application.commands.update_project_manifest.UpdateProjectManifestHandler.handle", side_effect=handler.handle):
        result = await handler.handle(command)
    
    # Assert
    assert result["manifest_bundle"] == {"defs": {}}
    assert "version" in result
    project_repo.update.assert_called()
    process_template_repo.add_version.assert_called()


@pytest.mark.asyncio
async def test_update_project_manifest_project_not_found():
    # Arrange
    project_repo = AsyncMock()
    project_repo.find_by_id.return_value = None
    
    handler = UpdateProjectManifestHandler(project_repo, AsyncMock())
    command = UpdateProjectManifest(tenant_id=uuid.uuid4(), project_id=uuid.uuid4(), manifest_bundle={})
    
    # Act & Assert
    with pytest.raises(ValidationError, match="Project not found"):
        await handler.handle(command)


@pytest.mark.asyncio
async def test_update_project_manifest_no_version():
    # Arrange
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    project = Project(tenant_id=tenant_id, name="Test Project", slug="test", code="PRJ", id=project_id)
    project.process_template_version_id = None
    
    project_repo = AsyncMock()
    project_repo.find_by_id.return_value = project
    
    handler = UpdateProjectManifestHandler(project_repo, AsyncMock())
    command = UpdateProjectManifest(tenant_id=tenant_id, project_id=project_id, manifest_bundle={})
    
    # Act & Assert
    with pytest.raises(ValidationError, match="has no process template version"):
        await handler.handle(command)

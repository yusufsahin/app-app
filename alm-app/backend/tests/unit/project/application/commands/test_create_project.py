import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from alm.project.application.commands.create_project import CreateProject, CreateProjectHandler
from alm.project.domain.entities import Project
from alm.shared.domain.exceptions import ConflictError, ValidationError


@pytest.mark.asyncio
async def test_create_project_success():
    # Arrange
    tenant_id = uuid.uuid4()
    user_id = uuid.uuid4()
    
    project_repo = AsyncMock()
    project_repo.find_by_tenant_and_code.return_value = None
    project_repo.find_by_tenant_and_slug.return_value = None
    project_repo.add.side_effect = lambda p: p  # return the same project object
    
    process_template_repo = AsyncMock()
    process_template_repo.find_version_by_template_slug.return_value = MagicMock(id=uuid.uuid4())
    process_template_repo.find_version_by_id.return_value = None # Skip _create_project_roots for this simple test
    
    project_member_repo = AsyncMock()
    artifact_repo = AsyncMock()
    tenant_repo = AsyncMock()
    
    handler = CreateProjectHandler(
        project_repo, process_template_repo, project_member_repo, artifact_repo, tenant_repo
    )
    
    command = CreateProject(
        tenant_id=tenant_id,
        code="PRJ",
        name="Test Project",
        description="Desc",
        created_by=user_id
    )
    
    # Act
    result = await handler.handle(command)
    
    # Assert
    assert result.code == "PRJ"
    assert result.name == "Test Project"
    project_repo.add.assert_called()
    project_member_repo.add.assert_called()


@pytest.mark.asyncio
async def test_create_project_invalid_code():
    # Arrange
    handler = CreateProjectHandler(AsyncMock(), AsyncMock(), AsyncMock(), AsyncMock(), AsyncMock())
    command = CreateProject(tenant_id=uuid.uuid4(), code="invalid-code!", name="Test")
    
    # Act & Assert
    with pytest.raises(ValidationError, match="Project code must be 2-10 uppercase alphanumeric"):
        await handler.handle(command)


@pytest.mark.asyncio
async def test_create_project_duplicate_code():
    # Arrange
    tenant_id = uuid.uuid4()
    project_repo = AsyncMock()
    project_repo.find_by_tenant_and_code.return_value = MagicMock(spec=Project)
    
    handler = CreateProjectHandler(
        project_repo, AsyncMock(), AsyncMock(), AsyncMock(), AsyncMock()
    )
    command = CreateProject(tenant_id=tenant_id, code="EXIST", name="Test")
    
    # Act & Assert
    with pytest.raises(ConflictError, match="already exists"):
        await handler.handle(command)

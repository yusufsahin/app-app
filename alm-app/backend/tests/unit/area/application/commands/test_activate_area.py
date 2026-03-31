import uuid
from unittest.mock import AsyncMock

import pytest

from alm.area.application.commands.activate_area import ActivateAreaNode, ActivateAreaNodeHandler
from alm.area.domain.entities import AreaNode
from alm.project.domain.entities import Project
from alm.shared.domain.exceptions import ValidationError


@pytest.mark.asyncio
async def test_activate_area_node_handler_success():
    # Arrange
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    node_id = uuid.uuid4()
    
    project = Project(tenant_id=tenant_id, name="Test Project", slug="test", code="TEST", id=project_id)
    node = AreaNode(project_id=project_id, name="Child", path="Parent/Child", id=node_id, is_active=False)
    
    project_repo = AsyncMock()
    project_repo.find_by_id.return_value = project
    
    area_repo = AsyncMock()
    area_repo.find_by_id.return_value = node
    
    handler = ActivateAreaNodeHandler(area_repo, project_repo)
    command = ActivateAreaNode(tenant_id=tenant_id, project_id=project_id, area_node_id=node_id)
    
    # Act
    result = await handler.handle(command)
    
    # Assert
    assert result.is_active is True
    area_repo.update.assert_called_with(node)
    assert node.is_active is True


@pytest.mark.asyncio
async def test_activate_area_node_handler_project_not_found():
    # Arrange
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    
    project_repo = AsyncMock()
    project_repo.find_by_id.return_value = None
    
    area_repo = AsyncMock()
    
    handler = ActivateAreaNodeHandler(area_repo, project_repo)
    command = ActivateAreaNode(tenant_id=tenant_id, project_id=project_id, area_node_id=uuid.uuid4())
    
    # Act & Assert
    with pytest.raises(ValidationError, match="Project not found"):
        await handler.handle(command)


@pytest.mark.asyncio
async def test_activate_area_node_handler_node_not_found():
    # Arrange
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    
    project = Project(tenant_id=tenant_id, name="Test Project", slug="test", code="TEST", id=project_id)
    
    project_repo = AsyncMock()
    project_repo.find_by_id.return_value = project
    
    area_repo = AsyncMock()
    area_repo.find_by_id.return_value = None
    
    handler = ActivateAreaNodeHandler(area_repo, project_repo)
    command = ActivateAreaNode(tenant_id=tenant_id, project_id=project_id, area_node_id=uuid.uuid4())
    
    # Act & Assert
    with pytest.raises(ValidationError, match="Area node not found"):
        await handler.handle(command)

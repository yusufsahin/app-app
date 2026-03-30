import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from alm.area.application.commands.move_area import MoveAreaNode, MoveAreaNodeHandler
from alm.area.domain.entities import AreaNode
from alm.project.domain.entities import Project
from alm.shared.domain.exceptions import ValidationError


@pytest.mark.asyncio
async def test_move_area_node_success_to_new_parent():
    # Arrange
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    node_id = uuid.uuid4()
    parent_id = uuid.uuid4()
    
    project = Project(tenant_id=tenant_id, name="Test Project", slug="test", code="TEST", id=project_id)
    node = AreaNode(project_id=project_id, name="Child", path="Parent/Child", id=node_id, parent_id=uuid.uuid4(), depth=1)
    new_parent = AreaNode(project_id=project_id, name="NewParent", path="NewParent", id=parent_id, depth=0)
    
    area_repo = AsyncMock()
    area_repo.find_by_id.side_effect = lambda id: {
        node_id: node,
        parent_id: new_parent
    }.get(id)
    area_repo.find_by_project_and_path.return_value = None
    area_repo.find_by_project_and_path_prefix.return_value = [node]
    
    project_repo = AsyncMock()
    project_repo.find_by_id.return_value = project
    
    handler = MoveAreaNodeHandler(area_repo, project_repo)
    command = MoveAreaNode(tenant_id=tenant_id, project_id=project_id, area_node_id=node_id, new_parent_id=parent_id)
    
    # Act
    result = await handler.handle(command)
    
    # Assert
    assert result.parent_id == parent_id
    assert result.path == "NewParent/Child"
    assert result.depth == 1
    area_repo.update.assert_called()


@pytest.mark.asyncio
async def test_move_area_node_success_to_root():
    # Arrange
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    node_id = uuid.uuid4()
    
    project = Project(tenant_id=tenant_id, name="Test Project", slug="test", code="TEST", id=project_id)
    node = AreaNode(project_id=project_id, name="Child", path="Parent/Child", id=node_id, parent_id=uuid.uuid4(), depth=1)
    
    area_repo = AsyncMock()
    area_repo.find_by_id.return_value = node
    area_repo.find_by_project_and_path.return_value = None
    area_repo.find_by_project_and_path_prefix.return_value = [node]
    
    project_repo = AsyncMock()
    project_repo.find_by_id.return_value = project
    
    handler = MoveAreaNodeHandler(area_repo, project_repo)
    command = MoveAreaNode(tenant_id=tenant_id, project_id=project_id, area_node_id=node_id, new_parent_id=None)
    
    # Act
    result = await handler.handle(command)
    
    # Assert
    assert result.parent_id is None
    assert result.path == "Child"
    assert result.depth == 0
    area_repo.update.assert_called()


@pytest.mark.asyncio
async def test_move_area_node_cycle_detection():
    # Arrange
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    node_id = uuid.uuid4()
    descendant_id = uuid.uuid4()
    
    project = Project(tenant_id=tenant_id, name="Test Project", slug="test", code="TEST", id=project_id)
    node = AreaNode(project_id=project_id, name="Parent", path="Parent", id=node_id, depth=0)
    descendant = AreaNode(project_id=project_id, name="Descendant", path="Parent/Child/Descendant", id=descendant_id, depth=2)
    
    area_repo = AsyncMock()
    area_repo.find_by_id.side_effect = lambda id: {
        node_id: node,
        descendant_id: descendant
    }.get(id)
    
    project_repo = AsyncMock()
    project_repo.find_by_id.return_value = project
    
    handler = MoveAreaNodeHandler(area_repo, project_repo)
    command = MoveAreaNode(tenant_id=tenant_id, project_id=project_id, area_node_id=node_id, new_parent_id=descendant_id)
    
    # Act & Assert
    with pytest.raises(ValidationError, match="Cannot move area under its own descendant"):
        await handler.handle(command)


@pytest.mark.asyncio
async def test_move_area_node_path_exists():
    # Arrange
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    node_id = uuid.uuid4()
    parent_id = uuid.uuid4()
    
    project = Project(tenant_id=tenant_id, name="Test Project", slug="test", code="TEST", id=project_id)
    node = AreaNode(project_id=project_id, name="Child", path="OldParent/Child", id=node_id, depth=1)
    new_parent = AreaNode(project_id=project_id, name="NewParent", path="NewParent", id=parent_id, depth=0)
    existing_node = AreaNode(project_id=project_id, name="Child", path="NewParent/Child", id=uuid.uuid4())
    
    area_repo = AsyncMock()
    area_repo.find_by_id.side_effect = lambda id: {
        node_id: node,
        parent_id: new_parent
    }.get(id)
    area_repo.find_by_project_and_path.return_value = existing_node
    
    project_repo = AsyncMock()
    project_repo.find_by_id.return_value = project
    
    handler = MoveAreaNodeHandler(area_repo, project_repo)
    command = MoveAreaNode(tenant_id=tenant_id, project_id=project_id, area_node_id=node_id, new_parent_id=parent_id)
    
    # Act & Assert
    with pytest.raises(ValidationError, match="Area path already exists"):
        await handler.handle(command)


@pytest.mark.asyncio
async def test_move_area_node_project_not_found():
    # Arrange
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    
    project_repo = AsyncMock()
    project_repo.find_by_id.return_value = None
    
    area_repo = AsyncMock()
    
    handler = MoveAreaNodeHandler(area_repo, project_repo)
    command = MoveAreaNode(tenant_id=tenant_id, project_id=project_id, area_node_id=uuid.uuid4(), new_parent_id=None)
    
    # Act & Assert
    with pytest.raises(ValidationError, match="Project not found"):
        await handler.handle(command)


@pytest.mark.asyncio
async def test_move_area_node_tenant_mismatch():
    # Arrange
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    different_tenant_id = uuid.uuid4()
    
    project = Project(tenant_id=different_tenant_id, name="Test Project", slug="test", code="TEST", id=project_id)
    
    project_repo = AsyncMock()
    project_repo.find_by_id.return_value = project
    
    area_repo = AsyncMock()
    
    handler = MoveAreaNodeHandler(area_repo, project_repo)
    command = MoveAreaNode(tenant_id=tenant_id, project_id=project_id, area_node_id=uuid.uuid4(), new_parent_id=None)
    
    # Act & Assert
    with pytest.raises(ValidationError, match="Project not found"):
        await handler.handle(command)


@pytest.mark.asyncio
async def test_move_area_node_not_found():
    # Arrange
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    
    project = Project(tenant_id=tenant_id, name="Test Project", slug="test", code="TEST", id=project_id)
    
    project_repo = AsyncMock()
    project_repo.find_by_id.return_value = project
    
    area_repo = AsyncMock()
    area_repo.find_by_id.return_value = None
    
    handler = MoveAreaNodeHandler(area_repo, project_repo)
    command = MoveAreaNode(tenant_id=tenant_id, project_id=project_id, area_node_id=uuid.uuid4(), new_parent_id=None)
    
    # Act & Assert
    with pytest.raises(ValidationError, match="Area node not found"):
        await handler.handle(command)


@pytest.mark.asyncio
async def test_move_area_node_project_mismatch():
    # Arrange
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    different_project_id = uuid.uuid4()
    node_id = uuid.uuid4()
    
    project = Project(tenant_id=tenant_id, name="Test Project", slug="test", code="TEST", id=project_id)
    node = AreaNode(project_id=different_project_id, name="Child", path="Parent/Child", id=node_id, depth=1)
    
    project_repo = AsyncMock()
    project_repo.find_by_id.return_value = project
    
    area_repo = AsyncMock()
    area_repo.find_by_id.return_value = node
    
    handler = MoveAreaNodeHandler(area_repo, project_repo)
    command = MoveAreaNode(tenant_id=tenant_id, project_id=project_id, area_node_id=node_id, new_parent_id=None)
    
    # Act & Assert
    with pytest.raises(ValidationError, match="Area node not found"):
        await handler.handle(command)


@pytest.mark.asyncio
async def test_move_area_node_new_parent_not_found():
    # Arrange
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    node_id = uuid.uuid4()
    parent_id = uuid.uuid4()
    
    project = Project(tenant_id=tenant_id, name="Test Project", slug="test", code="TEST", id=project_id)
    node = AreaNode(project_id=project_id, name="Child", path="Parent/Child", id=node_id, depth=1)
    
    project_repo = AsyncMock()
    project_repo.find_by_id.return_value = project
    
    area_repo = AsyncMock()
    area_repo.find_by_id.side_effect = lambda id: node if id == node_id else None
    
    handler = MoveAreaNodeHandler(area_repo, project_repo)
    command = MoveAreaNode(tenant_id=tenant_id, project_id=project_id, area_node_id=node_id, new_parent_id=parent_id)
    
    # Act & Assert
    with pytest.raises(ValidationError, match="New parent area not found"):
        await handler.handle(command)

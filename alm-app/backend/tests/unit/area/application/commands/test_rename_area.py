import uuid
from unittest.mock import AsyncMock

import pytest

from alm.area.application.commands.rename_area import RenameAreaNode, RenameAreaNodeHandler
from alm.area.domain.entities import AreaNode
from alm.project.domain.entities import Project
from alm.shared.domain.exceptions import ValidationError


@pytest.mark.asyncio
async def test_rename_area_node_success():
    # Arrange
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    node_id = uuid.uuid4()

    project = Project(tenant_id=tenant_id, name="Test Project", slug="test", code="TEST", id=project_id)
    node = AreaNode(project_id=project_id, name="OldName", path="OldName", id=node_id, depth=0)

    area_repo = AsyncMock()
    area_repo.find_by_id.return_value = node
    area_repo.find_by_project_and_path.return_value = None
    area_repo.find_by_project_and_path_prefix.return_value = [node]

    project_repo = AsyncMock()
    project_repo.find_by_id.return_value = project

    handler = RenameAreaNodeHandler(area_repo, project_repo)
    command = RenameAreaNode(tenant_id=tenant_id, project_id=project_id, area_node_id=node_id, new_name="NewName")

    # Act
    result = await handler.handle(command)

    # Assert
    assert result.name == "NewName"
    assert result.path == "NewName"
    area_repo.update.assert_called()


@pytest.mark.asyncio
async def test_rename_area_node_with_subtree():
    # Arrange
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    node_id = uuid.uuid4()
    child_id = uuid.uuid4()

    project = Project(tenant_id=tenant_id, name="Test Project", slug="test", code="TEST", id=project_id)
    node = AreaNode(project_id=project_id, name="OldParent", path="OldParent", id=node_id, depth=0)
    child = AreaNode(project_id=project_id, name="Child", path="OldParent/Child", id=child_id, parent_id=node_id, depth=1)

    area_repo = AsyncMock()
    area_repo.find_by_id.side_effect = lambda id: {
        node_id: node,
        child_id: child
    }.get(id)
    area_repo.find_by_project_and_path.return_value = None
    area_repo.find_by_project_and_path_prefix.return_value = [node, child]

    project_repo = AsyncMock()
    project_repo.find_by_id.return_value = project

    handler = RenameAreaNodeHandler(area_repo, project_repo)
    command = RenameAreaNode(tenant_id=tenant_id, project_id=project_id, area_node_id=node_id, new_name="NewParent")

    # Act
    result = await handler.handle(command)

    # Assert
    assert result.name == "NewParent"
    assert result.path == "NewParent"
    # Verify child path update via area_repo.update calls
    # node.update and child.update should be called
    assert area_repo.update.call_count >= 2


@pytest.mark.asyncio
async def test_rename_area_node_empty_name():
    # Arrange
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    node_id = uuid.uuid4()

    project = Project(tenant_id=tenant_id, name="Test Project", slug="test", code="TEST", id=project_id)
    node = AreaNode(project_id=project_id, name="OldName", path="OldName", id=node_id, depth=0)

    area_repo = AsyncMock()
    area_repo.find_by_id.return_value = node
    project_repo = AsyncMock()
    project_repo.find_by_id.return_value = project

    handler = RenameAreaNodeHandler(area_repo, project_repo)
    command = RenameAreaNode(tenant_id=tenant_id, project_id=project_id, area_node_id=node_id, new_name="  ")

    # Act & Assert
    with pytest.raises(ValidationError, match="Area name cannot be empty"):
        await handler.handle(command)


@pytest.mark.asyncio
async def test_rename_area_node_path_exists():
    # Arrange
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    node_id = uuid.uuid4()

    project = Project(tenant_id=tenant_id, name="Test Project", slug="test", code="TEST", id=project_id)
    node = AreaNode(project_id=project_id, name="OldName", path="OldName", id=node_id, depth=0)
    existing_node = AreaNode(project_id=project_id, name="NewName", path="NewName", id=uuid.uuid4())

    area_repo = AsyncMock()
    area_repo.find_by_id.return_value = node
    area_repo.find_by_project_and_path.return_value = existing_node

    project_repo = AsyncMock()
    project_repo.find_by_id.return_value = project

    handler = RenameAreaNodeHandler(area_repo, project_repo)
    command = RenameAreaNode(tenant_id=tenant_id, project_id=project_id, area_node_id=node_id, new_name="NewName")

    # Act & Assert
    with pytest.raises(ValidationError, match="Area path already exists"):
        await handler.handle(command)

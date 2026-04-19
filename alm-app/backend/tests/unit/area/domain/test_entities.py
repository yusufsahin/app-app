import uuid

import pytest

from alm.area.domain.entities import AreaNode


def test_area_node_create_root_success():
    project_id = uuid.uuid4()
    node = AreaNode.create_root(project_id, "RootNode")

    assert node.name == "RootNode"
    assert node.path == "RootNode"
    assert node.parent_id is None
    assert node.depth == 0
    assert node.project_id == project_id

def test_area_node_create_root_empty_name():
    project_id = uuid.uuid4()
    with pytest.raises(ValueError, match="Area node name cannot be empty"):
        AreaNode.create_root(project_id, "  ")

def test_area_node_create_child_success():
    project_id = uuid.uuid4()
    parent = AreaNode.create_root(project_id, "Parent")
    child = AreaNode.create_child(project_id, "Child", parent)

    assert child.name == "Child"
    assert child.path == "Parent/Child"
    assert child.parent_id == parent.id
    assert child.depth == 1

def test_area_node_create_child_different_project_failure():
    project_id_1 = uuid.uuid4()
    project_id_2 = uuid.uuid4()
    parent = AreaNode.create_root(project_id_1, "Parent")

    with pytest.raises(ValueError, match="Parent must belong to the same project"):
        AreaNode.create_child(project_id_2, "Child", parent)

def test_area_node_to_snapshot_dict():
    project_id = uuid.uuid4()
    node = AreaNode.create_root(project_id, "RootNode")
    snapshot = node.to_snapshot_dict()

    assert snapshot["name"] == "RootNode"
    assert snapshot["path"] == "RootNode"
    assert snapshot["project_id"] == str(project_id)
    assert snapshot["depth"] == 0
    assert "id" in snapshot

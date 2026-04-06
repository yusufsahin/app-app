"""Tests for ensure_project_tree_roots."""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from alm.project.application.services.ensure_project_tree_roots import ensure_project_tree_roots
from alm.project.domain.entities import Project
from tests.support.manifests import CREATE_PROJECT_ROOTS_MANIFEST_BUNDLE


@pytest.mark.asyncio
async def test_ensure_creates_roots_when_missing() -> None:
    tenant_id = uuid.uuid4()
    vid = uuid.uuid4()
    project = Project.create(
        tenant_id=tenant_id,
        name="P",
        slug="p",
        code="P1",
        description="",
    )
    project.process_template_version_id = vid

    version = MagicMock()
    version.id = vid
    version.manifest_bundle = {}

    process_template_repo = AsyncMock()
    process_template_repo.find_version_by_id.return_value = version

    artifact_repo = AsyncMock()
    artifact_repo.list_by_project.return_value = []

    n = await ensure_project_tree_roots(
        project=project,
        artifact_repo=artifact_repo,
        process_template_repo=process_template_repo,
        only_if_missing=True,
    )

    assert n >= 1
    assert artifact_repo.add.await_count == n


@pytest.mark.asyncio
async def test_ensure_skips_when_root_exists() -> None:
    tenant_id = uuid.uuid4()
    vid = uuid.uuid4()
    project = Project.create(
        tenant_id=tenant_id,
        name="P",
        slug="p",
        code="P1",
        description="",
    )
    project.process_template_version_id = vid

    version = MagicMock()
    version.id = vid
    version.manifest_bundle = {}

    process_template_repo = AsyncMock()
    process_template_repo.find_version_by_id.return_value = version

    existing = MagicMock()
    artifact_repo = AsyncMock()
    artifact_repo.list_by_project.return_value = [existing]

    n = await ensure_project_tree_roots(
        project=project,
        artifact_repo=artifact_repo,
        process_template_repo=process_template_repo,
        only_if_missing=True,
    )

    assert n == 0
    artifact_repo.add.assert_not_awaited()


@pytest.mark.asyncio
async def test_ensure_returns_zero_when_no_process_template_version() -> None:
    tenant_id = uuid.uuid4()
    vid = uuid.uuid4()
    project = Project.create(
        tenant_id=tenant_id,
        name="P",
        slug="p",
        code="P1",
        description="",
    )
    project.process_template_version_id = vid

    process_template_repo = AsyncMock()
    process_template_repo.find_version_by_id = AsyncMock(return_value=None)
    process_template_repo.find_default_version = AsyncMock(return_value=None)

    artifact_repo = AsyncMock()
    n = await ensure_project_tree_roots(
        project=project,
        artifact_repo=artifact_repo,
        process_template_repo=process_template_repo,
        only_if_missing=True,
    )
    assert n == 0
    artifact_repo.add.assert_not_awaited()


@pytest.mark.asyncio
async def test_ensure_creates_default_quality_and_testsuite_folders() -> None:
    """When manifest lists quality-folder / testsuite-folder under roots, seed one of each."""
    tenant_id = uuid.uuid4()
    vid = uuid.uuid4()
    project = Project.create(
        tenant_id=tenant_id,
        name="P",
        slug="p",
        code="PX",
        description="",
    )
    project.process_template_version_id = vid

    version = MagicMock()
    version.id = vid
    version.manifest_bundle = CREATE_PROJECT_ROOTS_MANIFEST_BUNDLE

    process_template_repo = AsyncMock()
    process_template_repo.find_version_by_id = AsyncMock(return_value=version)

    created_store: list = []

    async def _add(a):
        created_store.append(a)
        return a

    async def _list(_project_id, *args, **kwargs):
        type_filter = kwargs.get("type_filter")
        limit = kwargs.get("limit") or 10_000
        parent_id = kwargs.get("parent_id")
        if parent_id is not None:
            rows = [x for x in created_store if x.parent_id == parent_id and x.artifact_type == type_filter]
            return rows[:limit]
        if type_filter:
            rows = [x for x in created_store if x.artifact_type == type_filter and x.parent_id is None]
            return rows[:limit]
        return []

    artifact_repo = AsyncMock()
    artifact_repo.add = AsyncMock(side_effect=_add)
    artifact_repo.list_by_project = AsyncMock(side_effect=_list)

    n = await ensure_project_tree_roots(
        project=project,
        artifact_repo=artifact_repo,
        process_template_repo=process_template_repo,
        only_if_missing=True,
    )

    created_types = [a.artifact_type for a in created_store]
    assert "root-requirement" in created_types
    assert "root-quality" in created_types
    assert "quality-folder" in created_types
    assert "root-testsuites" in created_types
    assert "testsuite-folder" in created_types
    assert "root-defect" in created_types
    assert n == len(created_store)
    assert n >= 6

    qf = next(a for a in created_store if a.artifact_type == "quality-folder")
    rq = next(a for a in created_store if a.artifact_type == "root-quality")
    assert qf.parent_id == rq.id

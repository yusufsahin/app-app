"""Tests for ensure_project_tree_roots."""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from alm.project.application.services.ensure_project_tree_roots import ensure_project_tree_roots
from alm.project.domain.entities import Project


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

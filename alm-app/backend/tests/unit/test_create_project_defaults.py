"""Create project: tenant-level default process template slug."""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock

import pytest

from alm.project.application.commands.create_project import CreateProject, CreateProjectHandler
from alm.tenant.domain.entities import Tenant


@pytest.mark.asyncio
async def test_create_project_uses_tenant_default_process_template_slug() -> None:
    tenant_id = uuid.uuid4()
    tenant = Tenant(name="T", slug="t", id=tenant_id, settings={"default_process_template_slug": "scrum"})
    tenant_repo = AsyncMock()
    tenant_repo.find_by_id = AsyncMock(return_value=tenant)
    ver_id = uuid.uuid4()
    version = AsyncMock(id=ver_id, manifest_bundle=None)
    process_repo = AsyncMock()
    process_repo.find_version_by_template_slug = AsyncMock(return_value=version)
    process_repo.find_version_by_id = AsyncMock(return_value=version)
    project_repo = AsyncMock()
    project_repo.find_by_tenant_and_code = AsyncMock(return_value=None)
    project_repo.find_by_tenant_and_slug = AsyncMock(return_value=None)
    project_repo.add = AsyncMock(side_effect=lambda p: p)
    member_repo = AsyncMock()
    artifact_repo = AsyncMock()
    handler = CreateProjectHandler(
        project_repo=project_repo,
        process_template_repo=process_repo,
        project_member_repo=member_repo,
        artifact_repo=artifact_repo,
        tenant_repo=tenant_repo,
    )
    cmd = CreateProject(tenant_id=tenant_id, code="AB", name="My Project")
    await handler.handle(cmd)
    process_repo.find_version_by_template_slug.assert_awaited_once_with("scrum")


@pytest.mark.asyncio
async def test_create_project_explicit_slug_skips_tenant_default() -> None:
    tenant_id = uuid.uuid4()
    tenant = Tenant(name="T", slug="t", id=tenant_id, settings={"default_process_template_slug": "scrum"})
    tenant_repo = AsyncMock()
    tenant_repo.find_by_id = AsyncMock(return_value=tenant)
    ver_id = uuid.uuid4()
    version = AsyncMock(id=ver_id, manifest_bundle=None)
    process_repo = AsyncMock()
    process_repo.find_version_by_template_slug = AsyncMock(return_value=version)
    process_repo.find_version_by_id = AsyncMock(return_value=version)
    project_repo = AsyncMock()
    project_repo.find_by_tenant_and_code = AsyncMock(return_value=None)
    project_repo.find_by_tenant_and_slug = AsyncMock(return_value=None)
    project_repo.add = AsyncMock(side_effect=lambda p: p)
    handler = CreateProjectHandler(
        project_repo=project_repo,
        process_template_repo=process_repo,
        project_member_repo=AsyncMock(),
        artifact_repo=AsyncMock(),
        tenant_repo=tenant_repo,
    )
    cmd = CreateProject(
        tenant_id=tenant_id,
        code="CD",
        name="Other",
        process_template_slug="basic",
    )
    await handler.handle(cmd)
    process_repo.find_version_by_template_slug.assert_awaited_once_with("basic")
    tenant_repo.find_by_id.assert_not_awaited()

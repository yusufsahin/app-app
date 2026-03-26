from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient


def _unique_email() -> str:
    return f"bulk-link-{uuid.uuid4().hex[:12]}@example.com"


def _unique_org() -> str:
    return f"BulkLinkOrg-{uuid.uuid4().hex[:8]}"


async def _register_and_get_token(client: AsyncClient, email: str, org: str) -> str:
    reg = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "SecurePass123",
            "display_name": email.split("@")[0],
            "org_name": org,
        },
    )
    reg.raise_for_status()
    return reg.json()["access_token"]


async def _ensure_project(client: AsyncClient, token: str, tenant_id: str) -> str:
    create_resp = await client.post(
        f"/api/v1/tenants/{tenant_id}/projects/",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "code": f"P{uuid.uuid4().hex[:6].upper()}",
            "name": "Bulk Link Project",
            "description": "",
            "process_template_slug": "basic",
        },
    )
    create_resp.raise_for_status()
    return create_resp.json()["id"]


@pytest.mark.asyncio
async def test_bulk_link_and_unlink_suite_testcases(client: AsyncClient):
    token = await _register_and_get_token(client, _unique_email(), _unique_org())
    tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
    tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
    project_id = await _ensure_project(client, token, tenant_id)

    quality_roots = await client.get(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
        headers={"Authorization": f"Bearer {token}"},
        params={"include_system_roots": "true", "tree": "quality", "limit": 200, "offset": 0},
    )
    quality_roots.raise_for_status()
    quality_items = quality_roots.json()["items"]
    root_quality = next((a for a in quality_items if a["artifact_type"] == "root-quality"), None)
    assert root_quality is not None

    suites_roots = await client.get(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
        headers={"Authorization": f"Bearer {token}"},
        params={"include_system_roots": "true", "tree": "testsuites", "limit": 200, "offset": 0},
    )
    suites_roots.raise_for_status()
    suites_items = suites_roots.json()["items"]
    root_suites = next((a for a in suites_items if a["artifact_type"] == "root-testsuites"), None)
    assert root_suites is not None

    qa_folder_resp = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "artifact_type": "quality-folder",
            "title": "QA Folder",
            "description": "",
            "parent_id": root_quality["id"],
        },
    )
    qa_folder_resp.raise_for_status()
    qa_folder = qa_folder_resp.json()

    suite_folder_resp = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "artifact_type": "testsuite-folder",
            "title": "Suite Folder",
            "description": "",
            "parent_id": root_suites["id"],
        },
    )
    suite_folder_resp.raise_for_status()
    suite_folder = suite_folder_resp.json()

    tc1_resp = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "artifact_type": "test-case",
            "title": "TC-1",
            "description": "",
            "parent_id": qa_folder["id"],
        },
    )
    tc1_resp.raise_for_status()
    tc1 = tc1_resp.json()

    tc2_resp = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "artifact_type": "test-case",
            "title": "TC-2",
            "description": "",
            "parent_id": qa_folder["id"],
        },
    )
    tc2_resp.raise_for_status()
    tc2 = tc2_resp.json()

    suite_resp = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "artifact_type": "test-suite",
            "title": "Suite-1",
            "description": "",
            "parent_id": suite_folder["id"],
        },
    )
    suite_resp.raise_for_status()
    suite = suite_resp.json()

    bulk_link = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{suite['id']}/links/bulk",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "to_artifact_ids": [tc1["id"], tc2["id"]],
            "link_type": "suite_includes_test",
            "idempotency_key": str(uuid.uuid4()),
        },
    )
    bulk_link.raise_for_status()
    data = bulk_link.json()
    assert len(data["succeeded"]) == 2
    assert data["failed"] == []

    # Re-applying same request should be duplicate-safe (idempotent behavior)
    bulk_link_2 = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{suite['id']}/links/bulk",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "to_artifact_ids": [tc1["id"], tc2["id"]],
            "link_type": "suite_includes_test",
            "idempotency_key": str(uuid.uuid4()),
        },
    )
    bulk_link_2.raise_for_status()
    data2 = bulk_link_2.json()
    assert len(data2["succeeded"]) == 2

    links_resp = await client.get(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{suite['id']}/links",
        headers={"Authorization": f"Bearer {token}"},
    )
    links_resp.raise_for_status()
    links = [l for l in links_resp.json() if l["link_type"] == "suite_includes_test"]
    assert len(links) == 2

    bulk_unlink = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{suite['id']}/links/bulk-delete",
        headers={"Authorization": f"Bearer {token}"},
        json={"link_ids": [links[0]["id"], links[1]["id"]], "idempotency_key": str(uuid.uuid4())},
    )
    bulk_unlink.raise_for_status()
    unlinked = bulk_unlink.json()
    assert len(unlinked["succeeded"]) == 2
    assert unlinked["failed"] == []


@pytest.mark.asyncio
async def test_bulk_link_returns_partial_failure_for_missing_target(client: AsyncClient):
    token = await _register_and_get_token(client, _unique_email(), _unique_org())
    tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
    tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
    project_id = await _ensure_project(client, token, tenant_id)

    quality_roots = await client.get(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
        headers={"Authorization": f"Bearer {token}"},
        params={"include_system_roots": "true", "tree": "quality", "limit": 200, "offset": 0},
    )
    quality_roots.raise_for_status()
    root_quality = next((a for a in quality_roots.json()["items"] if a["artifact_type"] == "root-quality"), None)
    assert root_quality is not None

    suites_roots = await client.get(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
        headers={"Authorization": f"Bearer {token}"},
        params={"include_system_roots": "true", "tree": "testsuites", "limit": 200, "offset": 0},
    )
    suites_roots.raise_for_status()
    root_suites = next((a for a in suites_roots.json()["items"] if a["artifact_type"] == "root-testsuites"), None)
    assert root_suites is not None

    qa_folder_resp = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
        headers={"Authorization": f"Bearer {token}"},
        json={"artifact_type": "quality-folder", "title": "QA", "description": "", "parent_id": root_quality["id"]},
    )
    qa_folder_resp.raise_for_status()
    qa_folder = qa_folder_resp.json()

    suite_folder_resp = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
        headers={"Authorization": f"Bearer {token}"},
        json={"artifact_type": "testsuite-folder", "title": "Suites", "description": "", "parent_id": root_suites["id"]},
    )
    suite_folder_resp.raise_for_status()
    suite_folder = suite_folder_resp.json()

    tc_resp = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
        headers={"Authorization": f"Bearer {token}"},
        json={"artifact_type": "test-case", "title": "TC", "description": "", "parent_id": qa_folder["id"]},
    )
    tc_resp.raise_for_status()
    tc = tc_resp.json()

    suite_resp = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
        headers={"Authorization": f"Bearer {token}"},
        json={"artifact_type": "test-suite", "title": "Suite", "description": "", "parent_id": suite_folder["id"]},
    )
    suite_resp.raise_for_status()
    suite = suite_resp.json()

    missing_id = str(uuid.uuid4())
    bulk_link = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{suite['id']}/links/bulk",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "to_artifact_ids": [tc["id"], missing_id],
            "link_type": "suite_includes_test",
            "idempotency_key": str(uuid.uuid4()),
        },
    )
    bulk_link.raise_for_status()
    data = bulk_link.json()
    assert tc["id"] in data["succeeded"]
    assert any(item["id"] == missing_id for item in data["failed"])

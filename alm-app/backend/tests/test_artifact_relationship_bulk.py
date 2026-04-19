from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient


def _unique_email() -> str:
    return f"bulk-relationship-{uuid.uuid4().hex[:12]}@example.com"


def _unique_org() -> str:
    return f"BulkRelationshipOrg-{uuid.uuid4().hex[:8]}"


async def _register_and_get_token(client: AsyncClient, email: str, org: str) -> str:
    reg = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "SecurePass123",
            "display_name": email.split("@", maxsplit=1)[0],
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
            "name": "Bulk Relationship Project",
            "description": "",
            "process_template_slug": "basic",
        },
    )
    create_resp.raise_for_status()
    return create_resp.json()["id"]


async def _setup_quality_artifacts(client: AsyncClient, token: str, org_slug: str, project_id: str) -> tuple[dict, dict, dict, dict]:
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

    return root_quality, root_suites, qa_folder, suite_folder


@pytest.mark.asyncio
async def test_bulk_create_and_delete_suite_relationships(client: AsyncClient):
    token = await _register_and_get_token(client, _unique_email(), _unique_org())
    tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
    tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
    project_id = await _ensure_project(client, token, tenant_id)
    _, _, qa_folder, suite_folder = await _setup_quality_artifacts(client, token, org_slug, project_id)

    tc1 = (
        await client.post(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            json={"artifact_type": "test-case", "title": "TC-1", "description": "", "parent_id": qa_folder["id"]},
        )
    ).json()
    tc2 = (
        await client.post(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            json={"artifact_type": "test-case", "title": "TC-2", "description": "", "parent_id": qa_folder["id"]},
        )
    ).json()
    suite = (
        await client.post(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            json={"artifact_type": "test-suite", "title": "Suite-1", "description": "", "parent_id": suite_folder["id"]},
        )
    ).json()

    bulk_create = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{suite['id']}/relationships/bulk",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "target_artifact_ids": [tc1["id"], tc2["id"]],
            "relationship_type": "suite_includes_test",
            "idempotency_key": str(uuid.uuid4()),
        },
    )
    bulk_create.raise_for_status()
    payload = bulk_create.json()
    assert len(payload["succeeded"]) == 2
    assert payload["failed"] == []

    relationships_resp = await client.get(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{suite['id']}/relationships",
        headers={"Authorization": f"Bearer {token}"},
    )
    relationships_resp.raise_for_status()
    relationships = [row for row in relationships_resp.json() if row["relationship_type"] == "suite_includes_test"]
    assert len(relationships) == 2

    bulk_delete = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{suite['id']}/relationships/bulk-delete",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "relationship_ids": [relationships[0]["id"], relationships[1]["id"]],
            "idempotency_key": str(uuid.uuid4()),
        },
    )
    bulk_delete.raise_for_status()
    deleted = bulk_delete.json()
    assert len(deleted["succeeded"]) == 2
    assert deleted["failed"] == []


@pytest.mark.asyncio
async def test_bulk_create_relationships_returns_partial_failure_for_missing_target(client: AsyncClient):
    token = await _register_and_get_token(client, _unique_email(), _unique_org())
    tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
    tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
    project_id = await _ensure_project(client, token, tenant_id)
    _, _, qa_folder, suite_folder = await _setup_quality_artifacts(client, token, org_slug, project_id)

    tc = (
        await client.post(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            json={"artifact_type": "test-case", "title": "TC", "description": "", "parent_id": qa_folder["id"]},
        )
    ).json()
    suite = (
        await client.post(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            json={"artifact_type": "test-suite", "title": "Suite", "description": "", "parent_id": suite_folder["id"]},
        )
    ).json()

    missing_id = str(uuid.uuid4())
    bulk_create = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{suite['id']}/relationships/bulk",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "target_artifact_ids": [tc["id"], missing_id],
            "relationship_type": "suite_includes_test",
            "idempotency_key": str(uuid.uuid4()),
        },
    )
    bulk_create.raise_for_status()
    payload = bulk_create.json()
    assert tc["id"] in payload["succeeded"]
    assert any(item["id"] == missing_id for item in payload["failed"])


@pytest.mark.asyncio
async def test_reorder_suite_relationships(client: AsyncClient):
    token = await _register_and_get_token(client, _unique_email(), _unique_org())
    tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
    tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
    project_id = await _ensure_project(client, token, tenant_id)
    _, _, qa_folder, suite_folder = await _setup_quality_artifacts(client, token, org_slug, project_id)

    tc1 = (
        await client.post(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            json={"artifact_type": "test-case", "title": "TC-A", "description": "", "parent_id": qa_folder["id"]},
        )
    ).json()
    tc2 = (
        await client.post(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            json={"artifact_type": "test-case", "title": "TC-B", "description": "", "parent_id": qa_folder["id"]},
        )
    ).json()
    suite = (
        await client.post(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            json={"artifact_type": "test-suite", "title": "Suite", "description": "", "parent_id": suite_folder["id"]},
        )
    ).json()

    create_resp = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{suite['id']}/relationships/bulk",
        headers={"Authorization": f"Bearer {token}"},
        json={"target_artifact_ids": [tc1["id"], tc2["id"]], "relationship_type": "suite_includes_test"},
    )
    create_resp.raise_for_status()

    relationships_resp = await client.get(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{suite['id']}/relationships",
        headers={"Authorization": f"Bearer {token}"},
    )
    relationships_resp.raise_for_status()
    relationships = [row for row in relationships_resp.json() if row["relationship_type"] == "suite_includes_test"]
    assert len(relationships) == 2
    assert {row["sort_order"] for row in relationships} == {0, 1}
    id_a = next(row["id"] for row in relationships if row["target_artifact_id"] == tc1["id"])
    id_b = next(row["id"] for row in relationships if row["target_artifact_id"] == tc2["id"])

    reorder_resp = await client.patch(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{suite['id']}/relationships/reorder",
        headers={"Authorization": f"Bearer {token}"},
        json={"relationship_type": "suite_includes_test", "ordered_relationship_ids": [id_b, id_a]},
    )
    reorder_resp.raise_for_status()
    assert reorder_resp.status_code == 204

    reordered_resp = await client.get(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{suite['id']}/relationships",
        headers={"Authorization": f"Bearer {token}"},
    )
    reordered_resp.raise_for_status()
    reordered = [row for row in reordered_resp.json() if row["relationship_type"] == "suite_includes_test"]
    assert [row["target_artifact_id"] for row in reordered] == [tc2["id"], tc1["id"]]

    bad_resp = await client.patch(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{suite['id']}/relationships/reorder",
        headers={"Authorization": f"Bearer {token}"},
        json={"relationship_type": "suite_includes_test", "ordered_relationship_ids": [id_b]},
    )
    assert bad_resp.status_code == 400

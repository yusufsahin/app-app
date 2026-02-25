"""Integration tests for artifact flow (create, list, transition)."""
from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient


def _unique_email() -> str:
    return f"art-{uuid.uuid4().hex[:12]}@example.com"


def _unique_org() -> str:
    return f"ArtOrg-{uuid.uuid4().hex[:8]}"


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


async def _ensure_project(
    client: AsyncClient, token: str, tenant_id: str, code: str = "ART", name: str = "Art Project"
) -> str:
    """Create a project if needed and return project id."""
    list_resp = await client.get(
        f"/api/v1/tenants/{tenant_id}/projects/",
        headers={"Authorization": f"Bearer {token}"},
    )
    list_resp.raise_for_status()
    projects = list_resp.json()
    if projects:
        return projects[0]["id"]
    create_resp = await client.post(
        f"/api/v1/tenants/{tenant_id}/projects/",
        headers={"Authorization": f"Bearer {token}"},
        json={"code": code, "name": name, "description": ""},
    )
    create_resp.raise_for_status()
    return create_resp.json()["id"]


@pytest.mark.asyncio
class TestArtifactFlow:
    async def test_list_artifacts_empty(self, client: AsyncClient):
        token = await _register_and_get_token(client, _unique_email(), _unique_org())
        tenants = (
            await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})
        ).json()
        assert isinstance(tenants, list) and len(tenants) >= 1
        tenant_id = tenants[0]["id"]

        project_id = await _ensure_project(
            client, token, tenant_id, f"P{uuid.uuid4().hex[:6].upper()}", "Art Project"
        )

        org_slug = tenants[0]["slug"]
        resp = await client.get(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data and "total" in data
        assert isinstance(data["items"], list)
        assert data["total"] == 0

    async def test_create_and_list_artifact(self, client: AsyncClient):
        token = await _register_and_get_token(client, _unique_email(), _unique_org())
        tenants = (
            await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})
        ).json()
        assert isinstance(tenants, list) and len(tenants) >= 1
        tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
        project_id = await _ensure_project(
            client, token, tenant_id, f"P{uuid.uuid4().hex[:6].upper()}", "Art Project"
        )

        create_resp = await client.post(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "artifact_type": "requirement",
                "title": "Test requirement",
                "description": "Created by test",
            },
        )
        assert create_resp.status_code == 201
        created = create_resp.json()
        assert created["title"] == "Test requirement"
        assert created["artifact_type"] == "requirement"
        assert created["state"] == "new"
        artifact_id = created["id"]

        list_resp = await client.get(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert list_resp.status_code == 200
        payload = list_resp.json()
        items = payload["items"]
        assert payload["total"] >= 1
        found = next((a for a in items if a["id"] == artifact_id), None)
        assert found is not None
        assert found["state"] == "new"

    async def test_transition_artifact(self, client: AsyncClient):
        token = await _register_and_get_token(client, _unique_email(), _unique_org())
        tenants = (
            await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})
        ).json()
        assert isinstance(tenants, list) and len(tenants) >= 1
        tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
        project_id = await _ensure_project(
            client, token, tenant_id, f"P{uuid.uuid4().hex[:6].upper()}", "Art Project"
        )

        create_resp = await client.post(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "artifact_type": "defect",
                "title": "Test defect",
                "description": "",
            },
        )
        assert create_resp.status_code == 201
        artifact_id = create_resp.json()["id"]

        trans_resp = await client.patch(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{artifact_id}/transition",
            headers={"Authorization": f"Bearer {token}"},
            json={"new_state": "active"},
        )
        assert trans_resp.status_code == 200
        updated = trans_resp.json()
        assert updated["state"] == "active"

    async def test_list_artifacts_pagination(self, client: AsyncClient):
        token = await _register_and_get_token(client, _unique_email(), _unique_org())
        tenants = (
            await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})
        ).json()
        tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
        project_id = await _ensure_project(
            client, token, tenant_id, f"P{uuid.uuid4().hex[:6].upper()}", "Art Project"
        )
        for i in range(3):
            await client.post(
                f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
                headers={"Authorization": f"Bearer {token}"},
                json={"artifact_type": "requirement", "title": f"Item {i}", "description": ""},
            )
        resp = await client.get(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            params={"limit": 2, "offset": 1},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["items"]) <= 2
        assert data["total"] >= 3

    async def test_list_artifacts_filter_by_type(self, client: AsyncClient):
        token = await _register_and_get_token(client, _unique_email(), _unique_org())
        tenants = (
            await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})
        ).json()
        tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
        project_id = await _ensure_project(
            client, token, tenant_id, f"P{uuid.uuid4().hex[:6].upper()}", "Art Project"
        )
        await client.post(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            json={"artifact_type": "defect", "title": "A defect", "description": ""},
        )
        resp = await client.get(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            params={"type": "defect"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert all(a["artifact_type"] == "defect" for a in data["items"])

    async def test_update_artifact(self, client: AsyncClient):
        token = await _register_and_get_token(client, _unique_email(), _unique_org())
        tenants = (
            await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})
        ).json()
        tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
        project_id = await _ensure_project(
            client, token, tenant_id, f"P{uuid.uuid4().hex[:6].upper()}", "Art Project"
        )
        create_resp = await client.post(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            json={"artifact_type": "requirement", "title": "Original", "description": ""},
        )
        assert create_resp.status_code == 201
        artifact_id = create_resp.json()["id"]
        patch_resp = await client.patch(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{artifact_id}",
            headers={"Authorization": f"Bearer {token}"},
            json={"title": "Updated title", "description": "Updated desc"},
        )
        assert patch_resp.status_code == 200
        updated = patch_resp.json()
        assert updated["title"] == "Updated title"
        assert updated["description"] == "Updated desc"

    async def test_delete_artifact(self, client: AsyncClient):
        token = await _register_and_get_token(client, _unique_email(), _unique_org())
        tenants = (
            await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})
        ).json()
        tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
        project_id = await _ensure_project(
            client, token, tenant_id, f"P{uuid.uuid4().hex[:6].upper()}", "Art Project"
        )
        create_resp = await client.post(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            json={"artifact_type": "requirement", "title": "To delete", "description": ""},
        )
        assert create_resp.status_code == 201
        artifact_id = create_resp.json()["id"]
        del_resp = await client.delete(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{artifact_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert del_resp.status_code == 204
        list_resp = await client.get(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
        )
        list_resp.raise_for_status()
        items = list_resp.json()["items"]
        assert not any(a["id"] == artifact_id for a in items)

    async def test_batch_transition_artifacts(self, client: AsyncClient):
        token = await _register_and_get_token(client, _unique_email(), _unique_org())
        tenants = (
            await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})
        ).json()
        tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
        project_id = await _ensure_project(
            client, token, tenant_id, f"P{uuid.uuid4().hex[:6].upper()}", "Art Project"
        )
        ids = []
        for _ in range(2):
            cr = await client.post(
                f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
                headers={"Authorization": f"Bearer {token}"},
                json={"artifact_type": "requirement", "title": "Req", "description": ""},
            )
            ids.append(cr.json()["id"])
        resp = await client.post(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/batch-transition",
            headers={"Authorization": f"Bearer {token}"},
            json={"artifact_ids": ids, "new_state": "active"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success_count"] == 2
        assert data["error_count"] == 0

    async def test_batch_delete_artifacts(self, client: AsyncClient):
        token = await _register_and_get_token(client, _unique_email(), _unique_org())
        tenants = (
            await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})
        ).json()
        tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
        project_id = await _ensure_project(
            client, token, tenant_id, f"P{uuid.uuid4().hex[:6].upper()}", "Art Project"
        )
        ids = []
        for _ in range(2):
            cr = await client.post(
                f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
                headers={"Authorization": f"Bearer {token}"},
                json={"artifact_type": "requirement", "title": "To batch delete", "description": ""},
            )
            ids.append(cr.json()["id"])
        resp = await client.post(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/batch-delete",
            headers={"Authorization": f"Bearer {token}"},
            json={"artifact_ids": ids},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success_count"] == 2
        list_resp = await client.get(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
        )
        list_data = list_resp.json()
        assert not any(a["id"] in ids for a in list_data["items"])

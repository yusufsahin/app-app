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
        assert isinstance(data, list)

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
        items = list_resp.json()
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

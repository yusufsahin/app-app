"""Integration tests for tenant management flow."""
from __future__ import annotations

import pytest
from httpx import AsyncClient


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
    return reg.json()["access_token"]


@pytest.mark.asyncio
class TestTenantOperations:
    async def test_list_my_tenants(self, client: AsyncClient):
        token = await _register_and_get_token(client, "tenant1@example.com", "Tenant Org 1")
        response = await client.get(
            "/api/v1/tenants/",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert data[0]["name"] == "Tenant Org 1"

    async def test_get_tenant_detail(self, client: AsyncClient):
        token = await _register_and_get_token(client, "tenant2@example.com", "Tenant Org 2")
        tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
        tenant_id = tenants[0]["id"]

        response = await client.get(
            f"/api/v1/tenants/{tenant_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Tenant Org 2"


@pytest.mark.asyncio
class TestRoleManagement:
    async def test_list_roles(self, client: AsyncClient):
        token = await _register_and_get_token(client, "roles1@example.com", "Roles Org 1")
        tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
        tenant_id = tenants[0]["id"]

        response = await client.get(
            f"/api/v1/tenants/{tenant_id}/roles",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        roles = response.json()
        assert isinstance(roles, list)
        role_slugs = [r["slug"] for r in roles]
        assert "admin" in role_slugs
        assert "project_manager" in role_slugs

    async def test_list_privileges(self, client: AsyncClient):
        token = await _register_and_get_token(client, "priv1@example.com", "Priv Org 1")

        response = await client.get(
            "/api/v1/tenants/privileges",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        privs = response.json()
        assert isinstance(privs, list)
        assert len(privs) > 0


@pytest.mark.asyncio
class TestMemberManagement:
    async def test_list_members(self, client: AsyncClient):
        token = await _register_and_get_token(client, "member1@example.com", "Member Org 1")
        tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
        tenant_id = tenants[0]["id"]

        response = await client.get(
            f"/api/v1/tenants/{tenant_id}/members",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        members = response.json()
        assert len(members) >= 1
        assert members[0]["email"] == "member1@example.com"

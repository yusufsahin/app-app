"""Integration tests for dashboard API (stats and activity)."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient


def _unique_email() -> str:
    return f"dash-{uuid.uuid4().hex[:12]}@example.com"


def _unique_org() -> str:
    return f"DashOrg-{uuid.uuid4().hex[:8]}"


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


@pytest.mark.asyncio
class TestDashboardFlow:
    async def test_dashboard_stats_shape(self, client: AsyncClient) -> None:
        token = await _register_and_get_token(client, _unique_email(), _unique_org())
        tenants = (
            await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})
        ).json()
        assert isinstance(tenants, list) and len(tenants) >= 1
        org_slug = tenants[0]["slug"]

        resp = await client.get(
            f"/api/v1/orgs/{org_slug}/dashboard/stats",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "projects" in data
        assert "artifacts" in data
        assert "tasks" in data
        assert "openDefects" in data
        assert isinstance(data["projects"], int)
        assert isinstance(data["artifacts"], int)
        assert isinstance(data["tasks"], int)
        assert isinstance(data["openDefects"], int)
        assert data["projects"] >= 0

    async def test_dashboard_activity_shape(self, client: AsyncClient) -> None:
        token = await _register_and_get_token(client, _unique_email(), _unique_org())
        tenants = (
            await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})
        ).json()
        assert isinstance(tenants, list) and len(tenants) >= 1
        org_slug = tenants[0]["slug"]

        resp = await client.get(
            f"/api/v1/orgs/{org_slug}/dashboard/activity",
            headers={"Authorization": f"Bearer {token}"},
            params={"limit": 5},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        for item in data:
            assert "artifact_id" in item
            assert "project_id" in item
            assert "project_slug" in item
            assert "title" in item
            assert "state" in item
            assert "artifact_type" in item
            assert "updated_at" in item

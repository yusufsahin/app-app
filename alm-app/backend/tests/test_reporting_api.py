"""Reporting API: definitions catalog and validated runs."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient


def _unique_email() -> str:
    return f"rep-{uuid.uuid4().hex[:12]}@example.com"


def _unique_org() -> str:
    return f"RepOrg-{uuid.uuid4().hex[:8]}"


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
class TestReportingApi:
    async def test_definitions_lists_builtin_reports_with_schemas(self, client: AsyncClient) -> None:
        token = await _register_and_get_token(client, _unique_email(), _unique_org())
        tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
        org_slug = tenants[0]["slug"]

        resp = await client.get(
            f"/api/v1/orgs/{org_slug}/reports/definitions",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        ids = {item["id"] for item in data}
        assert "org.dashboard_snapshot" in ids
        assert "project.velocity" in ids
        assert "project.burndown" in ids
        for item in data:
            assert "parameter_schema" in item
            assert item["parameter_schema"].get("type") == "object"

    async def test_run_unknown_report_404(self, client: AsyncClient) -> None:
        token = await _register_and_get_token(client, _unique_email(), _unique_org())
        tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
        org_slug = tenants[0]["slug"]

        resp = await client.post(
            f"/api/v1/orgs/{org_slug}/reports/run",
            headers={"Authorization": f"Bearer {token}"},
            json={"report_id": "no.such.report", "parameters": {}},
        )
        assert resp.status_code == 404

    async def test_run_org_dashboard_snapshot(self, client: AsyncClient) -> None:
        token = await _register_and_get_token(client, _unique_email(), _unique_org())
        tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
        org_slug = tenants[0]["slug"]

        resp = await client.post(
            f"/api/v1/orgs/{org_slug}/reports/run",
            headers={"Authorization": f"Bearer {token}"},
            json={"report_id": "org.dashboard_snapshot", "parameters": {}},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["report_id"] == "org.dashboard_snapshot"
        assert body["row_limit"] == 5000
        assert "data" in body
        assert "projects" in body["data"]
        assert "artifacts" in body["data"]

    async def test_run_velocity_requires_project_and_validates_params(self, client: AsyncClient) -> None:
        token = await _register_and_get_token(client, _unique_email(), _unique_org())
        tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
        org_slug = tenants[0]["slug"]
        fake_pid = str(uuid.uuid4())

        bad = await client.post(
            f"/api/v1/orgs/{org_slug}/reports/run",
            headers={"Authorization": f"Bearer {token}"},
            json={"report_id": "project.velocity", "parameters": {}},
        )
        assert bad.status_code == 422

        ok = await client.post(
            f"/api/v1/orgs/{org_slug}/reports/run",
            headers={"Authorization": f"Bearer {token}"},
            json={"report_id": "project.velocity", "parameters": {"project_id": fake_pid}},
        )
        assert ok.status_code == 200
        ok_body = ok.json()
        assert ok_body["data"]["series"] == []
        assert ok_body["row_limit"] == 5000

    async def test_run_report_row_limit_echo_and_validation(self, client: AsyncClient) -> None:
        token = await _register_and_get_token(client, _unique_email(), _unique_org())
        tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
        org_slug = tenants[0]["slug"]

        resp = await client.post(
            f"/api/v1/orgs/{org_slug}/reports/run",
            headers={"Authorization": f"Bearer {token}"},
            json={"report_id": "org.dashboard_snapshot", "parameters": {}, "row_limit": 2500},
        )
        assert resp.status_code == 200
        assert resp.json()["row_limit"] == 2500

        bad_low = await client.post(
            f"/api/v1/orgs/{org_slug}/reports/run",
            headers={"Authorization": f"Bearer {token}"},
            json={"report_id": "org.dashboard_snapshot", "parameters": {}, "row_limit": 0},
        )
        assert bad_low.status_code == 422

        bad_high = await client.post(
            f"/api/v1/orgs/{org_slug}/reports/run",
            headers={"Authorization": f"Bearer {token}"},
            json={"report_id": "org.dashboard_snapshot", "parameters": {}, "row_limit": 50001},
        )
        assert bad_high.status_code == 422

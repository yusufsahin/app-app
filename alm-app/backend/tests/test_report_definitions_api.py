"""Integration: report definitions — catalog, fork, validate, publish, execute."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient


def _unique_email() -> str:
    return f"rdef-{uuid.uuid4().hex[:12]}@example.com"


def _unique_org() -> str:
    return f"RdefOrg-{uuid.uuid4().hex[:8]}"


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


async def _tenant_and_project(client: AsyncClient, token: str) -> tuple[str, str, str]:
    tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
    tenant_id = tenants[0]["id"]
    org_slug = tenants[0]["slug"]
    create_resp = await client.post(
        f"/api/v1/tenants/{tenant_id}/projects/",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "code": f"R{uuid.uuid4().hex[:6].upper()}",
            "name": "Report Def Project",
            "description": "",
            "process_template_slug": "basic",
        },
    )
    create_resp.raise_for_status()
    project_id = create_resp.json()["id"]
    return tenant_id, org_slug, project_id


@pytest.mark.asyncio
class TestReportDefinitionsApi:
    async def test_catalog_lists_templates(self, client: AsyncClient) -> None:
        token = await _register_and_get_token(client, _unique_email(), _unique_org())
        _, org_slug, _ = await _tenant_and_project(client, token)
        resp = await client.get(
            f"/api/v1/orgs/{org_slug}/report-templates/catalog",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        keys = {x["catalog_key"] for x in data}
        assert "tpl.builtin_org_dashboard" in keys
        assert "tpl.sql_artifacts_by_type" in keys

    async def test_fork_validate_publish_execute_sql_template(self, client: AsyncClient) -> None:
        token = await _register_and_get_token(client, _unique_email(), _unique_org())
        _, org_slug, project_id = await _tenant_and_project(client, token)
        hdrs = {"Authorization": f"Bearer {token}"}

        created = await client.post(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/report-definitions/from-catalog",
            headers=hdrs,
            json={"catalog_key": "tpl.sql_artifacts_by_type", "name": "My counts"},
        )
        assert created.status_code == 201
        rid = created.json()["id"]
        assert created.json()["lifecycle_status"] == "draft"
        assert created.json()["last_validation_ok"] is False

        val = await client.post(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/report-definitions/{rid}/validate",
            headers=hdrs,
        )
        assert val.status_code == 200
        assert val.json()["last_validation_ok"] is True

        pub = await client.post(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/report-definitions/{rid}/publish",
            headers=hdrs,
        )
        assert pub.status_code == 200
        assert pub.json()["lifecycle_status"] == "published"
        assert pub.json()["published_at"] is not None

        ex = await client.get(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/report-definitions/{rid}/execute",
            headers=hdrs,
            params={"allow_draft": "false"},
        )
        assert ex.status_code == 200
        body = ex.json()
        assert body["query_kind"] == "sql"
        assert "columns" in body and "rows" in body
        assert "chart_spec" in body
        assert body.get("row_limit") == 5000

    async def test_publish_fails_without_validate(self, client: AsyncClient) -> None:
        token = await _register_and_get_token(client, _unique_email(), _unique_org())
        _, org_slug, project_id = await _tenant_and_project(client, token)
        hdrs = {"Authorization": f"Bearer {token}"}

        created = await client.post(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/report-definitions/from-catalog",
            headers=hdrs,
            json={"catalog_key": "tpl.builtin_org_dashboard"},
        )
        assert created.status_code == 201
        rid = created.json()["id"]

        pub = await client.post(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/report-definitions/{rid}/publish",
            headers=hdrs,
        )
        assert pub.status_code == 422

    async def test_fork_copy(self, client: AsyncClient) -> None:
        token = await _register_and_get_token(client, _unique_email(), _unique_org())
        _, org_slug, project_id = await _tenant_and_project(client, token)
        hdrs = {"Authorization": f"Bearer {token}"}

        a = await client.post(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/report-definitions/from-catalog",
            headers=hdrs,
            json={"catalog_key": "tpl.builtin_org_dashboard"},
        )
        assert a.status_code == 201
        aid = a.json()["id"]

        b = await client.post(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/report-definitions/{aid}/fork",
            headers=hdrs,
            json={"name": "Forked dash"},
        )
        assert b.status_code == 201
        assert b.json()["name"] == "Forked dash"
        assert b.json()["forked_from_id"] == aid
        assert b.json()["lifecycle_status"] == "draft"

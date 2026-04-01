from __future__ import annotations

import io
import uuid

import pytest
from httpx import AsyncClient
from openpyxl import Workbook


def _unique_email() -> str:
    return f"art-io-{uuid.uuid4().hex[:12]}@example.com"


def _unique_org() -> str:
    return f"ArtIoOrg-{uuid.uuid4().hex[:8]}"


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
    client: AsyncClient, token: str, tenant_id: str, code: str = "ARIO", name: str = "Artifact IO Project"
) -> str:
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
        json={"code": code, "name": name, "description": "", "process_template_slug": "basic"},
    )
    create_resp.raise_for_status()
    return create_resp.json()["id"]


@pytest.mark.asyncio
class TestArtifactImportExport:
    async def test_exports_filtered_artifacts_as_csv(self, client: AsyncClient):
        token = await _register_and_get_token(client, _unique_email(), _unique_org())
        tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
        tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
        project_id = await _ensure_project(client, token, tenant_id)

        created = await client.post(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            json={"artifact_type": "defect", "title": "CSV export bug", "description": "Created for export"},
        )
        created.raise_for_status()

        response = await client.get(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/export",
            headers={"Authorization": f"Bearer {token}"},
            params={"format": "csv", "scope": "generic", "type": "defect"},
        )
        response.raise_for_status()

        assert response.headers["content-type"].startswith("text/csv")
        body = response.content.decode("utf-8-sig")
        assert "artifact_key" in body
        assert "CSV export bug" in body

    async def test_imports_testcases_from_xlsx(self, client: AsyncClient):
        token = await _register_and_get_token(client, _unique_email(), _unique_org())
        tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
        tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
        project_id = await _ensure_project(client, token, tenant_id)

        roots_resp = await client.get(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            params={"include_system_roots": "true", "tree": "quality", "limit": 200, "offset": 0},
        )
        roots_resp.raise_for_status()
        items = roots_resp.json()["items"]
        root_quality = next((a for a in items if a["artifact_type"] == "root-quality"), None)
        assert root_quality is not None

        folder_resp = await client.post(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "artifact_type": "quality-folder",
                "title": "Imported tests",
                "description": "",
                "parent_id": root_quality["id"],
            },
        )
        folder_resp.raise_for_status()
        folder = folder_resp.json()
        assert folder["artifact_key"]

        workbook = Workbook()
        artifacts_ws = workbook.active
        artifacts_ws.title = "artifacts"
        artifacts_ws.append(
            [
                "artifact_key",
                "artifact_type",
                "title",
                "description",
                "state",
                "parent_key",
                "path",
                "assignee_id",
                "team_id",
                "cycle_id",
                "area_node_id",
                "tag_names",
                "id",
                "parent_id",
                "created_at",
                "updated_at",
            ]
        )
        artifacts_ws.append(
            [
                "ARIO-TC-1",
                "test-case",
                "Imported login test",
                "Created from xlsx",
                "new",
                folder["artifact_key"],
                "Quality/Imported tests/Imported login test",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
            ]
        )
        steps_ws = workbook.create_sheet("test_case_steps")
        steps_ws.append(
            [
                "test_case_key",
                "step_number",
                "kind",
                "step_id",
                "action",
                "description",
                "expected_result",
                "called_test_case_key",
                "called_test_case_id",
                "called_test_case_title",
                "param_overrides_json",
            ]
        )
        steps_ws.append(["ARIO-TC-1", 1, "step", "step-1", "Open login page", "", "Login page shown", "", "", "", ""])
        payload = io.BytesIO()
        workbook.save(payload)

        response = await client.post(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/import",
            headers={"Authorization": f"Bearer {token}"},
            params={"scope": "testcases", "mode": "upsert", "validate_only": "false"},
            files={
                "file": (
                    "testcases.xlsx",
                    payload.getvalue(),
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
        )
        response.raise_for_status()
        data = response.json()
        assert data["created_count"] == 1
        assert data["failed_count"] == 0

        list_resp = await client.get(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            params={"type": "test-case", "limit": 50, "offset": 0, "tree": "quality"},
        )
        list_resp.raise_for_status()
        rows = list_resp.json()["items"]
        created = next(row for row in rows if row["artifact_key"] == "ARIO-TC-1")
        assert created["custom_fields"]["test_steps_json"][0]["name"] == "Open login page"

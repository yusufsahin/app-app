"""Integration tests for artifact flow (create, list, transition)."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient

from alm.artifact.domain.manifest_workflow_metadata import DEFAULT_SYSTEM_ROOT_TYPES


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
            "display_name": email.split("@", maxsplit=1)[0],
            "org_name": org,
        },
    )
    reg.raise_for_status()
    return reg.json()["access_token"]


async def _auth_user_id(client: AsyncClient, token: str) -> str:
    me = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    me.raise_for_status()
    return str(me.json()["id"])


async def _root_requirement_id(client: AsyncClient, token: str, org_slug: str, project_id: str) -> str:
    list_r = await client.get(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
        headers={"Authorization": f"Bearer {token}"},
        params={"include_system_roots": "true"},
    )
    list_r.raise_for_status()
    return next(a["id"] for a in list_r.json()["items"] if a["artifact_type"] == "root-requirement")


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
        json={"code": code, "name": name, "description": "", "process_template_slug": "basic"},
    )
    create_resp.raise_for_status()
    return create_resp.json()["id"]


async def _get_project_manifest(client: AsyncClient, token: str, org_slug: str, project_id: str) -> dict:
    resp = await client.get(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/manifest",
        headers={"Authorization": f"Bearer {token}"},
    )
    resp.raise_for_status()
    return resp.json()["manifest_bundle"]


@pytest.mark.asyncio
class TestArtifactFlow:
    async def test_list_schema_backlog_surface_respects_manifest_override(self, client: AsyncClient):
        token = await _register_and_get_token(client, _unique_email(), _unique_org())
        tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
        tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
        project_id = await _ensure_project(client, token, tenant_id, f"P{uuid.uuid4().hex[:6].upper()}", "Art Project")

        manifest_bundle = await _get_project_manifest(client, token, org_slug, project_id)
        manifest_bundle["artifact_list"] = {
            **(manifest_bundle.get("artifact_list") or {}),
            "surfaces": {
                **((manifest_bundle.get("artifact_list") or {}).get("surfaces") or {}),
                "backlog": {
                    "fixed_columns": ["title", "state", "updated_at", "severity"],
                },
            },
        }
        update_resp = await client.put(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/manifest",
            headers={"Authorization": f"Bearer {token}"},
            json={"manifest_bundle": manifest_bundle},
        )
        update_resp.raise_for_status()

        schema_resp = await client.get(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/list-schema",
            headers={"Authorization": f"Bearer {token}"},
            params={"entity_type": "artifact", "surface": "backlog"},
        )
        schema_resp.raise_for_status()
        column_keys = [column["key"] for column in schema_resp.json()["columns"]]
        assert column_keys == ["title", "state", "updated_at", "severity"]

    async def test_list_schema_defects_surface_respects_manifest_override(self, client: AsyncClient):
        token = await _register_and_get_token(client, _unique_email(), _unique_org())
        tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
        tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
        project_id = await _ensure_project(client, token, tenant_id, f"P{uuid.uuid4().hex[:6].upper()}", "Art Project")

        manifest_bundle = await _get_project_manifest(client, token, org_slug, project_id)
        manifest_bundle["artifact_list"] = {
            **(manifest_bundle.get("artifact_list") or {}),
            "surfaces": {
                **((manifest_bundle.get("artifact_list") or {}).get("surfaces") or {}),
                "defects": {
                    "fixed_columns": ["title", "severity", "updated_at"],
                    "exclude_columns": [
                        "artifact_key",
                        "artifact_type",
                        "state",
                        "tags",
                        "created_at",
                        "state_reason",
                        "resolution",
                    ],
                    "extra_column_limit": 2,
                },
            },
        }
        update_resp = await client.put(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/manifest",
            headers={"Authorization": f"Bearer {token}"},
            json={"manifest_bundle": manifest_bundle},
        )
        update_resp.raise_for_status()

        schema_resp = await client.get(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/list-schema",
            headers={"Authorization": f"Bearer {token}"},
            params={"entity_type": "artifact", "surface": "defects"},
        )
        schema_resp.raise_for_status()
        column_keys = [column["key"] for column in schema_resp.json()["columns"]]
        assert column_keys[:3] == ["title", "severity", "updated_at"]
        assert "state" not in column_keys
        assert "artifact_key" not in column_keys

    async def test_list_artifacts_excludes_system_roots(self, client: AsyncClient):
        token = await _register_and_get_token(client, _unique_email(), _unique_org())
        tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
        assert isinstance(tenants, list) and len(tenants) >= 1
        tenant_id = tenants[0]["id"]

        project_id = await _ensure_project(client, token, tenant_id, f"P{uuid.uuid4().hex[:6].upper()}", "Art Project")

        org_slug = tenants[0]["slug"]
        resp = await client.get(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data and "total" in data
        assert isinstance(data["items"], list)
        # Default list hides system root placeholders (they still exist for tree/parent links).
        # Process template seeding also adds default quality/testsuite folder rows under those roots.
        assert data["total"] == len(data["items"])
        assert {item["artifact_type"] for item in data["items"]} == {"quality-folder", "testsuite-folder"}
        for item in data["items"]:
            assert item["artifact_type"] not in DEFAULT_SYSTEM_ROOT_TYPES

    async def test_list_artifacts_tree_quality_param_ok(self, client: AsyncClient):
        """tree=quality resolves to root-quality subtree; includes seeded quality-folder only."""
        token = await _register_and_get_token(client, _unique_email(), _unique_org())
        tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
        tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
        project_id = await _ensure_project(client, token, tenant_id, f"P{uuid.uuid4().hex[:6].upper()}", "Art Project")

        resp = await client.get(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            params={"tree": "quality"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data and "total" in data
        assert data["total"] == 1
        assert len(data["items"]) == 1
        assert data["items"][0]["artifact_type"] == "quality-folder"

    async def test_list_artifacts_tree_testsuites_and_type_test_suite_ok(self, client: AsyncClient):
        """tree=testsuites with type=test-suite is accepted (empty project → zero rows)."""
        token = await _register_and_get_token(client, _unique_email(), _unique_org())
        tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
        tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
        project_id = await _ensure_project(client, token, tenant_id, f"P{uuid.uuid4().hex[:6].upper()}", "Art Project")

        resp = await client.get(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            params={"tree": "testsuites", "type": "test-suite"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0
        assert data["items"] == []

    async def test_list_artifacts_parent_id_param_ok(self, client: AsyncClient):
        """parent_id filter is accepted; unknown parent yields zero rows."""
        token = await _register_and_get_token(client, _unique_email(), _unique_org())
        tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
        tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
        project_id = await _ensure_project(client, token, tenant_id, f"P{uuid.uuid4().hex[:6].upper()}", "Art Project")

        resp = await client.get(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            params={"parent_id": str(uuid.uuid4())},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0
        assert data["items"] == []

    async def test_quality_testcase_requires_quality_folder_parent(self, client: AsyncClient):
        """Test cases must be created under a quality-folder (not root-quality or null)."""
        token = await _register_and_get_token(client, _unique_email(), _unique_org())
        tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
        tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
        project_id = await _ensure_project(client, token, tenant_id, f"P{uuid.uuid4().hex[:6].upper()}", "Art Project")

        roots_resp = await client.get(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            params={"include_system_roots": "true", "tree": "quality", "limit": 200, "offset": 0},
        )
        roots_resp.raise_for_status()
        items = roots_resp.json()["items"]
        root_quality = next((a for a in items if a["artifact_type"] == "root-quality"), None)
        test_folder = next((a for a in items if a["artifact_type"] == "quality-folder"), None)
        assert root_quality is not None, "project must have root-quality"
        if test_folder is None:
            mk_folder = await client.post(
                f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "artifact_type": "quality-folder",
                    "title": "QA Folder",
                    "description": "",
                    "parent_id": root_quality["id"],
                },
            )
            assert mk_folder.status_code == 201
            test_folder = mk_folder.json()
        assert test_folder is not None

        # parent_id omitted -> rejected
        r1 = await client.post(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            json={"artifact_type": "test-case", "title": "TC no parent", "description": ""},
        )
        assert r1.status_code == 422
        assert "quality-folder" in (r1.json().get("detail") or "")

        # parent_id = root-quality -> rejected
        r2 = await client.post(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            json={"artifact_type": "test-case", "title": "TC under root-quality", "description": "", "parent_id": root_quality["id"]},
        )
        assert r2.status_code == 422
        assert "quality-folder" in (r2.json().get("detail") or "")

        # parent_id = quality-folder -> ok
        r3 = await client.post(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            json={"artifact_type": "test-case", "title": "TC under folder", "description": "", "parent_id": test_folder["id"]},
        )
        assert r3.status_code == 201
        created = r3.json()
        assert created["artifact_type"] == "test-case"
        assert created["parent_id"] == test_folder["id"]

        # list direct children of the folder within quality tree
        list_resp = await client.get(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            params={"tree": "quality", "parent_id": test_folder["id"], "type": "test-case", "limit": 50, "offset": 0},
        )
        list_resp.raise_for_status()
        data = list_resp.json()
        assert data["total"] >= 1
        assert any(a["id"] == created["id"] for a in data["items"])

    @pytest.mark.parametrize("artifact_type", ["test-suite", "test-run", "test-campaign"])
    async def test_quality_types_require_testsuite_folder_parent(self, client: AsyncClient, artifact_type: str):
        """Suite/run/campaign types must be created under a testsuite-folder."""
        token = await _register_and_get_token(client, _unique_email(), _unique_org())
        tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
        tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
        project_id = await _ensure_project(client, token, tenant_id, f"P{uuid.uuid4().hex[:6].upper()}", "Art Project")

        roots_resp = await client.get(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            params={"include_system_roots": "true", "tree": "testsuites", "limit": 200, "offset": 0},
        )
        roots_resp.raise_for_status()
        items = roots_resp.json()["items"]
        root_suites = next((a for a in items if a["artifact_type"] == "root-testsuites"), None)
        assert root_suites is not None

        # Ensure there is a testsuite-folder to attach under
        mk_folder = await client.post(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "artifact_type": "testsuite-folder",
                "title": "QA Folder",
                "description": "",
                "parent_id": root_suites["id"],
            },
        )
        assert mk_folder.status_code == 201
        folder = mk_folder.json()

        # parent_id omitted -> rejected
        r1 = await client.post(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            json={"artifact_type": artifact_type, "title": f"{artifact_type} no parent", "description": ""},
        )
        assert r1.status_code == 422
        assert "testsuite-folder" in (r1.json().get("detail") or "")

        # parent_id = root-testsuites -> rejected
        r2 = await client.post(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            json={"artifact_type": artifact_type, "title": f"{artifact_type} under root", "description": "", "parent_id": root_suites["id"]},
        )
        assert r2.status_code == 422
        assert "testsuite-folder" in (r2.json().get("detail") or "")

        # parent_id = testsuite-folder -> ok
        r3 = await client.post(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            json={"artifact_type": artifact_type, "title": f"{artifact_type} under folder", "description": "", "parent_id": folder["id"]},
        )
        assert r3.status_code == 201
        assert r3.json()["parent_id"] == folder["id"]

    async def test_tree_quality_and_parent_id_does_not_leak_other_trees(self, client: AsyncClient):
        """tree=quality + parent_id must not return artifacts outside the quality subtree."""
        token = await _register_and_get_token(client, _unique_email(), _unique_org())
        tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
        tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
        project_id = await _ensure_project(client, token, tenant_id, f"P{uuid.uuid4().hex[:6].upper()}", "Art Project")

        roots = await client.get(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            params={"include_system_roots": "true", "limit": 200, "offset": 0},
        )
        roots.raise_for_status()
        items = roots.json()["items"]
        root_defect = next((a for a in items if a["artifact_type"] == "root-defect"), None)
        assert root_defect is not None

        # Create a defect under root-defect (outside quality tree)
        mk_def = await client.post(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            json={"artifact_type": "defect", "title": "Def outside quality", "description": "", "parent_id": root_defect["id"]},
        )
        assert mk_def.status_code == 201

        # Query quality tree but with parent_id set to defect root -> should yield zero
        resp = await client.get(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            params={"tree": "quality", "parent_id": root_defect["id"], "limit": 50, "offset": 0},
        )
        resp.raise_for_status()
        data = resp.json()
        assert data["total"] == 0
        assert data["items"] == []

    async def test_parent_id_filters_direct_children_only(self, client: AsyncClient):
        """parent_id returns only direct children (not grandchildren)."""
        token = await _register_and_get_token(client, _unique_email(), _unique_org())
        tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
        tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
        project_id = await _ensure_project(client, token, tenant_id, f"P{uuid.uuid4().hex[:6].upper()}", "Art Project")

        roots_resp = await client.get(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            params={"include_system_roots": "true", "tree": "quality", "limit": 200, "offset": 0},
        )
        roots_resp.raise_for_status()
        items = roots_resp.json()["items"]
        root_tests = next((a for a in items if a["artifact_type"] == "root-quality"), None)
        assert root_tests is not None

        f1 = await client.post(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            json={"artifact_type": "quality-folder", "title": "Folder 1", "description": "", "parent_id": root_tests["id"]},
        )
        assert f1.status_code == 201
        folder1 = f1.json()
        f2 = await client.post(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            json={"artifact_type": "quality-folder", "title": "Folder 2", "description": "", "parent_id": root_tests["id"]},
        )
        assert f2.status_code == 201
        folder2 = f2.json()

        # Create a child folder under folder1
        f1_child = await client.post(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            json={"artifact_type": "quality-folder", "title": "Folder 1.1", "description": "", "parent_id": folder1["id"]},
        )
        assert f1_child.status_code == 201
        folder11 = f1_child.json()

        # Create test-cases under folder1, folder1.1, folder2
        def _mk_tc(parent_id: str, title: str):
            return client.post(
                f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
                headers={"Authorization": f"Bearer {token}"},
                json={"artifact_type": "test-case", "title": title, "description": "", "parent_id": parent_id},
            )

        tc1 = await _mk_tc(folder1["id"], "TC under folder1")
        assert tc1.status_code == 201
        tc11 = await _mk_tc(folder11["id"], "TC under folder1.1")
        assert tc11.status_code == 201
        tc2 = await _mk_tc(folder2["id"], "TC under folder2")
        assert tc2.status_code == 201

        # parent_id=folder1 should include only tc1 and folder11 (if no type filter), but not tc11
        resp = await client.get(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            params={"tree": "quality", "parent_id": folder1["id"], "limit": 200, "offset": 0},
        )
        resp.raise_for_status()
        ids = {a["id"] for a in resp.json()["items"]}
        assert tc1.json()["id"] in ids
        assert folder11["id"] in ids
        assert tc11.json()["id"] not in ids

        # With type filter, only the test-case direct children should remain (folder row excluded)
        resp_tc = await client.get(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            params={"tree": "quality", "parent_id": folder1["id"], "type": "test-case", "limit": 200, "offset": 0},
        )
        resp_tc.raise_for_status()
        tc_ids = {a["id"] for a in resp_tc.json()["items"]}
        assert tc1.json()["id"] in tc_ids
        assert folder11["id"] not in tc_ids
        assert tc11.json()["id"] not in tc_ids

    async def test_create_and_list_artifact(self, client: AsyncClient):
        token = await _register_and_get_token(client, _unique_email(), _unique_org())
        tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
        assert isinstance(tenants, list) and len(tenants) >= 1
        tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
        project_id = await _ensure_project(client, token, tenant_id, f"P{uuid.uuid4().hex[:6].upper()}", "Art Project")

        root_id = await _root_requirement_id(client, token, org_slug, project_id)
        create_resp = await client.post(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "artifact_type": "workitem",
                "title": "Test work item",
                "description": "Created by test",
                "parent_id": root_id,
            },
        )
        assert create_resp.status_code == 201
        created = create_resp.json()
        assert created["title"] == "Test work item"
        assert created["artifact_type"] == "workitem"
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
        tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
        assert isinstance(tenants, list) and len(tenants) >= 1
        tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
        project_id = await _ensure_project(client, token, tenant_id, f"P{uuid.uuid4().hex[:6].upper()}", "Art Project")
        list_r = await client.get(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            params={"include_system_roots": "true"},
        )
        list_r.raise_for_status()
        root_defect = next((a for a in list_r.json()["items"] if a["artifact_type"] == "root-defect"), None)
        assert root_defect is not None, "project must have root-defect"
        create_resp = await client.post(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "artifact_type": "defect",
                "title": "Test defect",
                "description": "",
                "parent_id": root_defect["id"],
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

    async def test_get_permitted_transitions(self, client: AsyncClient):
        token = await _register_and_get_token(client, _unique_email(), _unique_org())
        tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
        assert isinstance(tenants, list) and len(tenants) >= 1
        tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
        project_id = await _ensure_project(client, token, tenant_id, f"P{uuid.uuid4().hex[:6].upper()}", "Art Project")
        root_id = await _root_requirement_id(client, token, org_slug, project_id)
        create_resp = await client.post(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "artifact_type": "workitem",
                "title": "For permitted-transitions",
                "description": "",
                "parent_id": root_id,
            },
        )
        assert create_resp.status_code == 201
        artifact_id = create_resp.json()["id"]

        resp = await client.get(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{artifact_id}/permitted-transitions",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert isinstance(data["items"], list)
        for item in data["items"]:
            assert "trigger" in item
            assert "to_state" in item

    async def test_list_artifacts_pagination(self, client: AsyncClient):
        token = await _register_and_get_token(client, _unique_email(), _unique_org())
        tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
        tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
        project_id = await _ensure_project(client, token, tenant_id, f"P{uuid.uuid4().hex[:6].upper()}", "Art Project")
        root_id = await _root_requirement_id(client, token, org_slug, project_id)
        for i in range(3):
            r = await client.post(
                f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "artifact_type": "workitem",
                    "title": f"Item {i}",
                    "description": "",
                    "parent_id": root_id,
                },
            )
            r.raise_for_status()
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
        tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
        tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
        project_id = await _ensure_project(client, token, tenant_id, f"P{uuid.uuid4().hex[:6].upper()}", "Art Project")
        list_r = await client.get(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            params={"include_system_roots": "true"},
        )
        list_r.raise_for_status()
        root_defect = next((a for a in list_r.json()["items"] if a["artifact_type"] == "root-defect"), None)
        assert root_defect is not None
        await client.post(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            json={"artifact_type": "defect", "title": "A defect", "description": "", "parent_id": root_defect["id"]},
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
        tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
        tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
        project_id = await _ensure_project(client, token, tenant_id, f"P{uuid.uuid4().hex[:6].upper()}", "Art Project")
        root_id = await _root_requirement_id(client, token, org_slug, project_id)
        create_resp = await client.post(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "artifact_type": "workitem",
                "title": "Original",
                "description": "",
                "parent_id": root_id,
            },
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
        tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
        tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
        project_id = await _ensure_project(client, token, tenant_id, f"P{uuid.uuid4().hex[:6].upper()}", "Art Project")
        root_id = await _root_requirement_id(client, token, org_slug, project_id)
        create_resp = await client.post(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "artifact_type": "workitem",
                "title": "To delete",
                "description": "",
                "parent_id": root_id,
            },
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
        tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
        tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
        project_id = await _ensure_project(client, token, tenant_id, f"P{uuid.uuid4().hex[:6].upper()}", "Art Project")
        user_id = await _auth_user_id(client, token)
        root_id = await _root_requirement_id(client, token, org_slug, project_id)
        ids = []
        for i in range(2):
            cr = await client.post(
                f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "artifact_type": "workitem",
                    "title": f"Req {i}",
                    "description": "",
                    "parent_id": root_id,
                },
            )
            cr.raise_for_status()
            aid = cr.json()["id"]
            asg = await client.patch(
                f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{aid}",
                headers={"Authorization": f"Bearer {token}"},
                json={"assignee_id": user_id},
            )
            asg.raise_for_status()
            ids.append(aid)
        resp = await client.post(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/batch-transition",
            headers={"Authorization": f"Bearer {token}"},
            json={"artifact_ids": ids, "new_state": "active"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success_count"] == 2
        assert data["error_count"] == 0
        assert "results" in data
        for aid in ids:
            assert data["results"].get(str(aid)) == "ok"

    async def test_batch_delete_artifacts(self, client: AsyncClient):
        token = await _register_and_get_token(client, _unique_email(), _unique_org())
        tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
        tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
        project_id = await _ensure_project(client, token, tenant_id, f"P{uuid.uuid4().hex[:6].upper()}", "Art Project")
        root_id = await _root_requirement_id(client, token, org_slug, project_id)
        ids = []
        for i in range(2):
            cr = await client.post(
                f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "artifact_type": "workitem",
                    "title": f"To batch delete {i}",
                    "description": "",
                    "parent_id": root_id,
                },
            )
            cr.raise_for_status()
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

    async def test_project_has_expected_roots_after_create(self, client: AsyncClient):
        """Creating a project with template yields four system root artifacts (requirement / tests / testsuites / defect)."""
        token = await _register_and_get_token(client, _unique_email(), _unique_org())
        tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
        tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
        code = f"R{uuid.uuid4().hex[:6].upper()}"
        create_resp = await client.post(
            f"/api/v1/tenants/{tenant_id}/projects/",
            headers={"Authorization": f"Bearer {token}"},
            json={"code": code, "name": "Root Test Project", "description": "", "process_template_slug": "basic"},
        )
        create_resp.raise_for_status()
        project_id = create_resp.json()["id"]
        list_resp = await client.get(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            params={"include_system_roots": "true"},
        )
        list_resp.raise_for_status()
        data = list_resp.json()
        roots = [
            a
            for a in data["items"]
            if a["artifact_type"] in ("root-requirement", "root-quality", "root-testsuites", "root-defect")
        ]
        assert len(roots) == 4
        keys = {a["artifact_key"] for a in roots}
        assert f"{code}-R0" in keys and f"{code}-Q0" in keys and f"{code}-TS0" in keys and f"{code}-D0" in keys

    async def test_delete_root_returns_422(self, client: AsyncClient):
        """Deleting a project root artifact must be rejected with 422 (ValidationError)."""
        token = await _register_and_get_token(client, _unique_email(), _unique_org())
        tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
        tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
        project_id = await _ensure_project(client, token, tenant_id, f"P{uuid.uuid4().hex[:6].upper()}", "Art Project")
        list_resp = await client.get(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
            headers={"Authorization": f"Bearer {token}"},
            params={"include_system_roots": "true"},
        )
        list_resp.raise_for_status()
        root = next((a for a in list_resp.json()["items"] if a["artifact_type"] == "root-requirement"), None)
        assert root is not None
        del_resp = await client.delete(
            f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{root['id']}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert del_resp.status_code == 422

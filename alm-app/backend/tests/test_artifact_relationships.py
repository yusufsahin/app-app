from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient


def _unique_email() -> str:
    return f"relationship-{uuid.uuid4().hex[:12]}@example.com"


def _unique_org() -> str:
    return f"RelationshipOrg-{uuid.uuid4().hex[:8]}"


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
            "code": f"R{uuid.uuid4().hex[:6].upper()}",
            "name": "Relationship Project",
            "description": "",
            "process_template_slug": "basic",
        },
    )
    create_resp.raise_for_status()
    return create_resp.json()["id"]


async def _root_id(client: AsyncClient, token: str, org_slug: str, project_id: str, *, tree: str, artifact_type: str) -> str:
    resp = await client.get(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
        headers={"Authorization": f"Bearer {token}"},
        params={"include_system_roots": "true", "tree": tree, "limit": 200, "offset": 0},
    )
    resp.raise_for_status()
    items = resp.json()["items"]
    root = next((item for item in items if item["artifact_type"] == artifact_type), None)
    assert root is not None
    return root["id"]


async def _create_artifact(
    client: AsyncClient,
    token: str,
    org_slug: str,
    project_id: str,
    *,
    artifact_type: str,
    title: str,
    parent_id: str,
) -> dict:
    resp = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "artifact_type": artifact_type,
            "title": title,
            "description": "",
            "parent_id": parent_id,
        },
    )
    resp.raise_for_status()
    return resp.json()


@pytest.mark.asyncio
async def test_relationship_options_and_detail_projection(client: AsyncClient) -> None:
    token = await _register_and_get_token(client, _unique_email(), _unique_org())
    tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
    tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
    project_id = await _ensure_project(client, token, tenant_id)

    root_requirement_id = await _root_id(
        client, token, org_slug, project_id, tree="requirement", artifact_type="root-requirement"
    )
    root_quality_id = await _root_id(client, token, org_slug, project_id, tree="quality", artifact_type="root-quality")
    root_defect_id = await _root_id(client, token, org_slug, project_id, tree="defect", artifact_type="root-defect")
    root_suite_id = await _root_id(
        client, token, org_slug, project_id, tree="testsuites", artifact_type="root-testsuites"
    )

    planning_item = await _create_artifact(
        client, token, org_slug, project_id, artifact_type="workitem", title="Work item A", parent_id=root_requirement_id
    )
    quality_folder = await _create_artifact(
        client, token, org_slug, project_id, artifact_type="quality-folder", title="Quality Folder", parent_id=root_quality_id
    )
    suite_folder = await _create_artifact(
        client, token, org_slug, project_id, artifact_type="testsuite-folder", title="Suite Folder", parent_id=root_suite_id
    )
    test_case = await _create_artifact(
        client, token, org_slug, project_id, artifact_type="test-case", title="Test Case A", parent_id=quality_folder["id"]
    )
    defect = await _create_artifact(
        client, token, org_slug, project_id, artifact_type="defect", title="Defect A", parent_id=root_defect_id
    )
    run = await _create_artifact(
        client, token, org_slug, project_id, artifact_type="test-run", title="Run A", parent_id=suite_folder["id"]
    )

    options_resp = await client.get(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{test_case['id']}/relationships/options",
        headers={"Authorization": f"Bearer {token}"},
    )
    options_resp.raise_for_status()
    option_keys = {item["key"] for item in options_resp.json()}
    assert "verifies" in option_keys
    assert "blocks" not in option_keys

    create_verifies = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{test_case['id']}/relationships",
        headers={"Authorization": f"Bearer {token}"},
        json={"target_artifact_id": planning_item["id"], "relationship_type": "verifies"},
    )
    create_verifies.raise_for_status()
    assert create_verifies.json()["display_label"] == "Verifies"

    requirement_relationships = await client.get(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{planning_item['id']}/relationships",
        headers={"Authorization": f"Bearer {token}"},
    )
    requirement_relationships.raise_for_status()
    requirement_items = requirement_relationships.json()
    assert len(requirement_items) == 1
    assert requirement_items[0]["display_label"] == "Verified By"
    assert requirement_items[0]["other_artifact_type"] == "test-case"

    create_discovered_in = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{defect['id']}/relationships",
        headers={"Authorization": f"Bearer {token}"},
        json={"target_artifact_id": run["id"], "relationship_type": "discovered_in"},
    )
    create_discovered_in.raise_for_status()

    run_relationships = await client.get(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{run['id']}/relationships",
        headers={"Authorization": f"Bearer {token}"},
    )
    run_relationships.raise_for_status()
    run_items = run_relationships.json()
    assert len(run_items) == 1
    assert run_items[0]["display_label"] == "Found Defects"
    assert run_items[0]["other_artifact_type"] == "defect"

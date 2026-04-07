"""Integration tests: S4b stale traceability when upstream planning items change."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient

from tests.test_scm_links import _create_artifact, _ensure_project, _register_and_get_token, _root_id


def _unique_email() -> str:
    return f"st-{uuid.uuid4().hex[:12]}@example.com"


def _unique_org() -> str:
    return f"StOrg-{uuid.uuid4().hex[:8]}"


@pytest.mark.asyncio
async def test_upstream_title_change_marks_verifying_test_stale(client: AsyncClient) -> None:
    token = await _register_and_get_token(client, _unique_email(), _unique_org())
    tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
    tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
    project_id = await _ensure_project(client, token, tenant_id)

    req_root = await _root_id(
        client, token, org_slug, project_id, tree="requirement", artifact_type="root-requirement"
    )
    requirement = await _create_artifact(
        client,
        token,
        org_slug,
        project_id,
        artifact_type="workitem",
        title="Upstream work item",
        parent_id=req_root,
        artifact_key="ST-REQ-1",
    )
    q_folder = await _root_id(
        client, token, org_slug, project_id, tree="quality", artifact_type="quality-folder"
    )
    test_case = await _create_artifact(
        client,
        token,
        org_slug,
        project_id,
        artifact_type="test-case",
        title="Case A",
        parent_id=q_folder,
    )

    rel = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{test_case['id']}/relationships",
        headers={"Authorization": f"Bearer {token}"},
        json={"target_artifact_id": requirement["id"], "relationship_type": "verifies"},
    )
    assert rel.status_code == 201, rel.text

    fresh = await client.get(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{test_case['id']}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert fresh.status_code == 200
    assert fresh.json().get("stale_traceability") is False

    list_url = f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts"
    list_stale_params = {"stale_traceability_only": "true", "limit": 200}
    before_list = await client.get(
        list_url,
        params=list_stale_params,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert before_list.status_code == 200
    assert test_case["id"] not in {a["id"] for a in before_list.json()["items"]}

    patch_req = await client.patch(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{requirement['id']}",
        headers={"Authorization": f"Bearer {token}"},
        json={"title": "Upstream req (edited)"},
    )
    assert patch_req.status_code == 200, patch_req.text

    after = await client.get(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{test_case['id']}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert after.status_code == 200
    body = after.json()
    assert body.get("stale_traceability") is True
    assert body.get("stale_traceability_reason") == "upstream_planning_changed"
    assert body.get("stale_traceability_at") is not None

    stale_only = await client.get(
        list_url,
        params=list_stale_params,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert stale_only.status_code == 200
    assert test_case["id"] in {a["id"] for a in stale_only.json()["items"]}

    clear = await client.patch(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{test_case['id']}",
        headers={"Authorization": f"Bearer {token}"},
        json={"clear_stale_traceability": True},
    )
    assert clear.status_code == 200, clear.text
    cleared = clear.json()
    assert cleared.get("stale_traceability") is False
    assert cleared.get("stale_traceability_reason") is None
    assert cleared.get("stale_traceability_at") is None

    after_clear_list = await client.get(
        list_url,
        params=list_stale_params,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert after_clear_list.status_code == 200
    assert test_case["id"] not in {a["id"] for a in after_clear_list.json()["items"]}

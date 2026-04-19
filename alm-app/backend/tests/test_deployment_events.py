"""Integration tests: deployment events API (S4a)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import pytest
from httpx import AsyncClient


def _unique_email() -> str:
    return f"dep-{uuid.uuid4().hex[:12]}@example.com"


def _unique_org() -> str:
    return f"DepOrg-{uuid.uuid4().hex[:8]}"


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


async def _ensure_project(client: AsyncClient, token: str, tenant_id: str) -> str:
    create_resp = await client.post(
        f"/api/v1/tenants/{tenant_id}/projects/",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "code": f"D{uuid.uuid4().hex[:6].upper()}",
            "name": "Deploy Project",
            "description": "",
            "process_template_slug": "basic",
        },
    )
    create_resp.raise_for_status()
    return create_resp.json()["id"]


@pytest.mark.asyncio
async def test_deployment_events_create_list_idempotent(client: AsyncClient) -> None:
    token = await _register_and_get_token(client, _unique_email(), _unique_org())
    tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
    tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
    project_id = await _ensure_project(client, token, tenant_id)

    ts = datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    body = {
        "environment": "staging",
        "occurred_at": ts,
        "commit_sha": "a" * 40,
        "repo_full_name": "acme/app",
        "artifact_keys": ["REQ-1"],
        "build_id": "pipeline-99",
        "source": "ci_webhook",
        "idempotency_key": "idem-1",
    }
    r1 = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/deployment-events",
        headers={"Authorization": f"Bearer {token}"},
        json=body,
    )
    assert r1.status_code == 201, r1.text
    j1 = r1.json()
    assert j1["environment"] == "staging"
    assert j1["commit_sha"] == "a" * 40
    assert j1["artifact_keys"] == ["REQ-1"]

    r2 = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/deployment-events",
        headers={"Authorization": f"Bearer {token}"},
        json=body,
    )
    assert r2.status_code == 201, r2.text
    assert r2.json()["id"] == j1["id"]

    listed = await client.get(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/deployment-events",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    filt = await client.get(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/deployment-events",
        headers={"Authorization": f"Bearer {token}"},
        params={"artifact_key": "REQ-1"},
    )
    assert filt.status_code == 200
    assert len(filt.json()) == 1

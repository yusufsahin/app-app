"""Integration tests: artifact traceability summary API."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import pytest
from httpx import AsyncClient

from tests.test_deployment_events import _ensure_project, _register_and_get_token
from tests.test_scm_links import _create_artifact, _root_id


def _unique_email() -> str:
    return f"ts-{uuid.uuid4().hex[:12]}@example.com"


def _unique_org() -> str:
    return f"TsOrg-{uuid.uuid4().hex[:8]}"


@pytest.mark.asyncio
async def test_traceability_summary_key_and_sha(client: AsyncClient) -> None:
    token = await _register_and_get_token(client, _unique_email(), _unique_org())
    tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
    tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
    project_id = await _ensure_project(client, token, tenant_id)
    root_requirement_id = await _root_id(
        client, token, org_slug, project_id, tree="requirement", artifact_type="root-requirement"
    )
    work = await _create_artifact(
        client,
        token,
        org_slug,
        project_id,
        artifact_type="workitem",
        title="Trace story",
        parent_id=root_requirement_id,
        artifact_key="TS-KEY-1",
    )
    aid = work["id"]
    sha = "b" * 40
    pr_url = f"https://github.com/acme/ts/pull/3"
    link = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{aid}/scm-links",
        headers={"Authorization": f"Bearer {token}"},
        json={"web_url": pr_url, "commit_sha": sha},
    )
    assert link.status_code == 201, link.text

    ts = datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    dep = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/deployment-events",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "environment": "prod",
            "occurred_at": ts,
            "commit_sha": sha,
            "source": "api",
        },
    )
    assert dep.status_code == 201, dep.text
    dep2 = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/deployment-events",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "environment": "staging",
            "occurred_at": ts,
            "artifact_keys": ["TS-KEY-1"],
            "source": "manual",
        },
    )
    assert dep2.status_code == 201, dep2.text

    summ = await client.get(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{aid}/traceability-summary",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert summ.status_code == 200, summ.text
    body = summ.json()
    assert body["artifact_key"] == "TS-KEY-1"
    assert len(body["scm_links"]) >= 1
    envs = {e["environment"]: e for e in body["environments"]}
    assert "prod" in envs
    assert "staging" in envs
    assert envs["prod"]["matched_via"] == "commit_sha"
    assert envs["staging"]["matched_via"] == "artifact_key"


@pytest.mark.asyncio
async def test_traceability_summary_unknown_artifact_returns_validation_problem(client: AsyncClient) -> None:
    token = await _register_and_get_token(client, _unique_email(), _unique_org())
    tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
    tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
    project_id = await _ensure_project(client, token, tenant_id)
    bogus_id = str(uuid.uuid4())

    summ = await client.get(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{bogus_id}/traceability-summary",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert summ.status_code == 422
    body = summ.json()
    assert body.get("status") == 422
    assert "Artifact not found" in (body.get("detail") or "")

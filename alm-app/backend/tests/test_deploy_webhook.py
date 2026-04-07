"""Integration tests: signed deploy webhook."""

from __future__ import annotations

import hashlib
import hmac
import json
import uuid
from datetime import UTC, datetime

import pytest
from httpx import AsyncClient

from tests.test_deployment_events import _ensure_project, _register_and_get_token


def _unique_email() -> str:
    return f"dw-{uuid.uuid4().hex[:12]}@example.com"


def _unique_org() -> str:
    return f"DwOrg-{uuid.uuid4().hex[:8]}"


def _sign(secret: str, body: bytes) -> str:
    mac = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return f"sha256={mac}"


@pytest.mark.asyncio
async def test_deploy_webhook_creates_event_and_ping(client: AsyncClient) -> None:
    token = await _register_and_get_token(client, _unique_email(), _unique_org())
    tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
    tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
    project_id = await _ensure_project(client, token, tenant_id)

    secret = "deploy-wh-secret-xyz"
    patch = await client.patch(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"settings": {"deploy_webhook_secret": secret}},
    )
    assert patch.status_code == 200, patch.text
    assert patch.json().get("deploy_webhook_secret_configured") is True

    url = f"/api/v1/orgs/{org_slug}/projects/{project_id}/webhooks/deploy"
    ping_body = json.dumps({"ping": True}).encode()
    ping = await client.post(
        url,
        content=ping_body,
        headers={
            "X-Hub-Signature-256": _sign(secret, ping_body),
            "Content-Type": "application/json",
        },
    )
    assert ping.status_code == 200, ping.text
    assert ping.json() == {"status": "ok"}

    ts = datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    payload = {"environment": "staging", "occurred_at": ts, "build_id": "run-1"}
    raw = json.dumps(payload, separators=(",", ":")).encode()
    wh = await client.post(
        url,
        content=raw,
        headers={
            "X-Hub-Signature-256": _sign(secret, raw),
            "Content-Type": "application/json",
        },
    )
    assert wh.status_code == 200, wh.text
    assert wh.json().get("status") == "created"

    listed = await client.get(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/deployment-events",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert listed.status_code == 200
    rows = listed.json()
    assert len(rows) >= 1
    assert rows[0]["environment"] == "staging"
    assert rows[0]["source"] == "ci_webhook"

    bad = await client.post(
        url,
        content=raw,
        headers={
            "X-Hub-Signature-256": "sha256=deadbeef",
            "Content-Type": "application/json",
        },
    )
    assert bad.status_code == 401


@pytest.mark.asyncio
async def test_deploy_webhook_invalid_json_returns_400(client: AsyncClient) -> None:
    token = await _register_and_get_token(client, _unique_email(), _unique_org())
    tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
    tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
    project_id = await _ensure_project(client, token, tenant_id)

    secret = "deploy-secret-json"
    await client.patch(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"settings": {"deploy_webhook_secret": secret}},
    )

    url = f"/api/v1/orgs/{org_slug}/projects/{project_id}/webhooks/deploy"
    body = b"{not-json"
    res = await client.post(
        url,
        content=body,
        headers={
            "X-Hub-Signature-256": _sign(secret, body),
            "Content-Type": "application/json",
        },
    )
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_deploy_webhook_duplicate_delivery_header(client: AsyncClient) -> None:
    token = await _register_and_get_token(client, _unique_email(), _unique_org())
    tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
    tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
    project_id = await _ensure_project(client, token, tenant_id)

    secret = "deploy-secret-dup"
    await client.patch(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"settings": {"deploy_webhook_secret": secret}},
    )

    url = f"/api/v1/orgs/{org_slug}/projects/{project_id}/webhooks/deploy"
    delivery = f"pipe-{uuid.uuid4().hex[:12]}"
    ts = datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    payload = {"environment": "dup-env", "occurred_at": ts, "build_id": "dup-build"}
    raw = json.dumps(payload, separators=(",", ":")).encode()
    headers = {
        "X-Hub-Signature-256": _sign(secret, raw),
        "Content-Type": "application/json",
        "X-ALM-Deploy-Delivery": delivery,
    }

    first = await client.post(url, content=raw, headers=headers)
    assert first.status_code == 200, first.text
    assert first.json().get("status") == "created"

    second = await client.post(url, content=raw, headers=headers)
    assert second.status_code == 200, second.text
    assert second.json() == {"status": "ignored", "reason": "duplicate_delivery"}

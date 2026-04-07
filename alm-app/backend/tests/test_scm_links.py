"""Integration tests: SCM links on artifacts (API)."""

from __future__ import annotations

import hashlib
import hmac
import json
import uuid

import pytest
from httpx import AsyncClient

from alm.orgs.api.scm_webhook_support import SCM_WEBHOOK_MAX_BODY_BYTES


def _unique_email() -> str:
    return f"scm-{uuid.uuid4().hex[:12]}@example.com"


def _unique_org() -> str:
    return f"ScmOrg-{uuid.uuid4().hex[:8]}"


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
            "code": f"S{uuid.uuid4().hex[:6].upper()}",
            "name": "SCM Project",
            "description": "",
            "process_template_slug": "basic",
        },
    )
    create_resp.raise_for_status()
    return create_resp.json()["id"]


async def _root_id(
    client: AsyncClient, token: str, org_slug: str, project_id: str, *, tree: str, artifact_type: str
) -> str:
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
    artifact_key: str | None = None,
) -> dict:
    payload: dict = {
        "artifact_type": artifact_type,
        "title": title,
        "description": "",
        "parent_id": parent_id,
    }
    if artifact_key is not None:
        payload["artifact_key"] = artifact_key
    resp = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts",
        headers={"Authorization": f"Bearer {token}"},
        json=payload,
    )
    resp.raise_for_status()
    return resp.json()


@pytest.mark.asyncio
async def test_scm_links_github_pr_crud_and_duplicate(client: AsyncClient) -> None:
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
        title="Story for SCM",
        parent_id=root_requirement_id,
    )
    artifact_id = work["id"]

    pr_url = "https://github.com/acme/demo/pull/42"
    create = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{artifact_id}/scm-links",
        headers={"Authorization": f"Bearer {token}"},
        json={"web_url": pr_url},
    )
    assert create.status_code == 201, create.text
    row = create.json()
    assert row["provider"] == "github"
    assert row["repo_full_name"] == "acme/demo"
    assert row["pull_request_number"] == 42
    assert row["web_url"] == pr_url
    assert row["title"] == "PR #42"
    link_id = row["id"]

    preview_dup = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{artifact_id}/scm-links/parse-preview",
        headers={"Authorization": f"Bearer {token}"},
        json={"web_url": pr_url},
    )
    assert preview_dup.status_code == 200, preview_dup.text
    prev_dup = preview_dup.json()
    assert prev_dup["duplicate_kind"] == "url"
    assert prev_dup["duplicate_link_id"] == link_id

    listed = await client.get(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{artifact_id}/scm-links",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    dup = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{artifact_id}/scm-links",
        headers={"Authorization": f"Bearer {token}"},
        json={"web_url": pr_url},
    )
    assert dup.status_code == 422

    equiv = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{artifact_id}/scm-links",
        headers={"Authorization": f"Bearer {token}"},
        json={"web_url": f"{pr_url}?tab=files"},
    )
    assert equiv.status_code == 422

    deleted = await client.delete(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{artifact_id}/scm-links/{link_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert deleted.status_code == 204

    empty = await client.get(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{artifact_id}/scm-links",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert empty.status_code == 200
    assert empty.json() == []


@pytest.mark.asyncio
async def test_parse_preview_github_pr_strips_query(client: AsyncClient) -> None:
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
        title="Preview target",
        parent_id=root_requirement_id,
    )
    artifact_id = work["id"]

    raw = "https://github.com/acme/demo/pull/7?tab=files"
    resp = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{artifact_id}/scm-links/parse-preview",
        headers={"Authorization": f"Bearer {token}"},
        json={"web_url": raw},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["recognized"] is True
    assert body["canonical_web_url"] == "https://github.com/acme/demo/pull/7"
    assert body["provider"] == "github"
    assert body["repo_full_name"] == "acme/demo"
    assert body["pull_request_number"] == 7
    assert body["suggested_title"] == "PR #7"
    assert body.get("artifact_key_hints") == []
    assert body.get("artifact_key_unmatched") == []
    assert body.get("duplicate_kind") == "none"

    hint_resp = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{artifact_id}/scm-links/parse-preview",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "web_url": raw,
            "context_text": "Closes REQ-88; see BUG-2",
        },
    )
    assert hint_resp.status_code == 200, hint_resp.text
    hint_body = hint_resp.json()
    assert hint_body["artifact_key_hints"] == ["REQ-88", "BUG-2"]
    assert hint_body["artifact_key_matches"] == []
    assert hint_body["artifact_key_unmatched"] == ["REQ-88", "BUG-2"]
    assert hint_body.get("duplicate_kind") == "none"


@pytest.mark.asyncio
async def test_parse_preview_duplicate_same_gitlab_mr_different_host(client: AsyncClient) -> None:
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
        title="MR dup preview",
        parent_id=root_requirement_id,
    )
    artifact_id = work["id"]

    url_a = "https://gitlab.com/acme/app/-/merge_requests/11"
    create = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{artifact_id}/scm-links",
        headers={"Authorization": f"Bearer {token}"},
        json={"web_url": url_a},
    )
    assert create.status_code == 201, create.text
    link_id = create.json()["id"]

    url_b = "https://gitlab.acme.internal/acme/app/-/merge_requests/11"
    prev = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{artifact_id}/scm-links/parse-preview",
        headers={"Authorization": f"Bearer {token}"},
        json={"web_url": url_b},
    )
    assert prev.status_code == 200, prev.text
    body = prev.json()
    assert body["duplicate_kind"] == "pull_request"
    assert body["duplicate_link_id"] == link_id
    assert body["canonical_web_url"] == url_b.rstrip("/")


@pytest.mark.asyncio
async def test_parse_preview_matches_context_keys_to_project_artifacts(client: AsyncClient) -> None:
    token = await _register_and_get_token(client, _unique_email(), _unique_org())
    tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
    tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
    project_id = await _ensure_project(client, token, tenant_id)

    root_requirement_id = await _root_id(
        client, token, org_slug, project_id, tree="requirement", artifact_type="root-requirement"
    )
    story = await _create_artifact(
        client,
        token,
        org_slug,
        project_id,
        artifact_type="workitem",
        title="Story A",
        parent_id=root_requirement_id,
    )
    story_id = story["id"]
    unique_key = f"ZSCM{uuid.uuid4().hex[:6].upper()}-1"
    other = await _create_artifact(
        client,
        token,
        org_slug,
        project_id,
        artifact_type="workitem",
        title="Linked by key",
        parent_id=root_requirement_id,
        artifact_key=unique_key,
    )
    other_id = other["id"]

    resp = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{story_id}/scm-links/parse-preview",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "web_url": "https://github.com/acme/demo/pull/1",
            "context_text": f"Implements {unique_key}",
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert unique_key in body["artifact_key_hints"]
    matches = body["artifact_key_matches"]
    assert len(matches) == 1
    assert matches[0]["artifact_id"] == other_id
    assert matches[0]["artifact_key"] == unique_key
    assert matches[0]["is_current_artifact"] is False
    assert body.get("artifact_key_unmatched") == []
    assert body.get("duplicate_kind") == "none"

    own_key = story.get("artifact_key")
    assert own_key
    self_ref = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{story_id}/scm-links/parse-preview",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "web_url": "https://github.com/acme/demo/pull/2",
            "context_text": f"Refs {own_key}",
        },
    )
    assert self_ref.status_code == 200, self_ref.text
    self_matches = self_ref.json()["artifact_key_matches"]
    assert len(self_matches) == 1
    assert self_matches[0]["artifact_id"] == story_id
    assert self_matches[0]["is_current_artifact"] is True
    assert self_ref.json().get("artifact_key_unmatched") == []
    assert self_ref.json().get("duplicate_kind") == "none"


@pytest.mark.asyncio
async def test_scm_link_generic_url_with_repo_full_name(client: AsyncClient) -> None:
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
        title="Other",
        parent_id=root_requirement_id,
    )
    artifact_id = work["id"]

    create = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{artifact_id}/scm-links",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "web_url": "https://internal.git.example/foo/bar/-/merge_requests/1",
            "repo_full_name": "foo/bar",
            "provider": "gitlab",
        },
    )
    assert create.status_code == 201, create.text
    row = create.json()
    assert row["provider"] == "gitlab"
    assert row["repo_full_name"] == "foo/bar"


@pytest.mark.asyncio
async def test_scm_link_with_task_scope(client: AsyncClient) -> None:
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
        title="With tasks",
        parent_id=root_requirement_id,
    )
    artifact_id = work["id"]

    task_resp = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{artifact_id}/tasks",
        headers={"Authorization": f"Bearer {token}"},
        json={"title": "Implement API", "description": ""},
    )
    assert task_resp.status_code == 201, task_resp.text
    task_id = task_resp.json()["id"]

    pr_url = "https://github.com/org/proj/pull/99"
    create = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{artifact_id}/scm-links",
        headers={"Authorization": f"Bearer {token}"},
        json={"web_url": pr_url, "task_id": task_id},
    )
    assert create.status_code == 201, create.text
    assert create.json()["task_id"] == task_id

    filtered = await client.get(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{artifact_id}/scm-links",
        headers={"Authorization": f"Bearer {token}"},
        params={"task_id": task_id},
    )
    assert filtered.status_code == 200
    assert len(filtered.json()) == 1

    all_links = await client.get(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{artifact_id}/scm-links",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert len(all_links.json()) == 1


def _github_pr_payload(*, html_url: str, number: int, head_ref: str, title: str = "x", body: str = "") -> bytes:
    payload = {
        "action": "opened",
        "pull_request": {
            "html_url": html_url,
            "number": number,
            "title": title,
            "body": body,
            "head": {"ref": head_ref},
            "merged": False,
        },
        "repository": {"full_name": "acme/repo"},
    }
    return json.dumps(payload, separators=(",", ":")).encode("utf-8")


@pytest.mark.asyncio
async def test_github_webhook_pr_creates_scm_link(client: AsyncClient) -> None:
    token = await _register_and_get_token(client, _unique_email(), _unique_org())
    tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
    tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
    project_id = await _ensure_project(client, token, tenant_id)

    secret = "whsec-test-secret"
    patch = await client.patch(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"settings": {"scm_github_webhook_secret": secret}},
    )
    assert patch.status_code == 200, patch.text
    patch_body = patch.json()
    assert patch_body.get("scm_webhook_github_secret_configured") is True
    assert "scm_github_webhook_secret" not in (patch_body.get("settings") or {})

    root_requirement_id = await _root_id(
        client, token, org_slug, project_id, tree="requirement", artifact_type="root-requirement"
    )
    work = await _create_artifact(
        client,
        token,
        org_slug,
        project_id,
        artifact_type="workitem",
        title="Webhook story",
        parent_id=root_requirement_id,
        artifact_key="GH-99",
    )
    artifact_id = work["id"]

    raw = _github_pr_payload(
        html_url="https://github.com/acme/repo/pull/7",
        number=7,
        head_ref="feature/GH-99-desc",
    )
    sig = hmac.new(secret.encode("utf-8"), raw, hashlib.sha256).hexdigest()

    wh = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/webhooks/github",
        content=raw,
        headers={
            "X-GitHub-Event": "pull_request",
            "X-Hub-Signature-256": f"sha256={sig}",
            "Content-Type": "application/json",
        },
    )
    assert wh.status_code == 200, wh.text
    assert wh.json()["status"] == "created"

    links = await client.get(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{artifact_id}/scm-links",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert links.status_code == 200
    rows = links.json()
    assert len(rows) == 1
    assert rows[0]["web_url"] == "https://github.com/acme/repo/pull/7"
    assert rows[0]["source"] == "webhook"
    assert rows[0]["created_by"] is None


@pytest.mark.asyncio
async def test_github_webhook_pr_refs_trailer_sets_task_id(client: AsyncClient) -> None:
    token = await _register_and_get_token(client, _unique_email(), _unique_org())
    tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
    tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
    project_id = await _ensure_project(client, token, tenant_id)

    secret = "whsec-refs-trailer"
    patch = await client.patch(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"settings": {"scm_github_webhook_secret": secret}},
    )
    assert patch.status_code == 200, patch.text

    root_requirement_id = await _root_id(
        client, token, org_slug, project_id, tree="requirement", artifact_type="root-requirement"
    )
    work = await _create_artifact(
        client,
        token,
        org_slug,
        project_id,
        artifact_type="workitem",
        title="Refs trailer story",
        parent_id=root_requirement_id,
        artifact_key="GH-77",
    )
    artifact_id = work["id"]

    task_resp = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{artifact_id}/tasks",
        headers={"Authorization": f"Bearer {token}"},
        json={"title": "Subtask", "description": ""},
    )
    assert task_resp.status_code == 201, task_resp.text
    task_id = task_resp.json()["id"]

    body = f"Work for story.\n\nRefs: {task_id}"
    raw = _github_pr_payload(
        html_url="https://github.com/acme/repo/pull/77",
        number=77,
        head_ref="feature/GH-77-desc",
        title="PR with Refs trailer",
        body=body,
    )
    sig = hmac.new(secret.encode("utf-8"), raw, hashlib.sha256).hexdigest()

    wh = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/webhooks/github",
        content=raw,
        headers={
            "X-GitHub-Event": "pull_request",
            "X-Hub-Signature-256": f"sha256={sig}",
            "Content-Type": "application/json",
        },
    )
    assert wh.status_code == 200, wh.text
    assert wh.json()["status"] == "created"

    links = await client.get(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{artifact_id}/scm-links",
        headers={"Authorization": f"Bearer {token}"},
    )
    rows = links.json()
    assert len(rows) == 1
    assert rows[0]["task_id"] == task_id


@pytest.mark.asyncio
async def test_github_webhook_duplicate_returns_duplicate_status(client: AsyncClient) -> None:
    token = await _register_and_get_token(client, _unique_email(), _unique_org())
    tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
    tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
    project_id = await _ensure_project(client, token, tenant_id)

    secret = "whsec-dup-secret"
    patch = await client.patch(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"settings": {"scm_github_webhook_secret": secret}},
    )
    assert patch.status_code == 200, patch.text

    root_requirement_id = await _root_id(
        client, token, org_slug, project_id, tree="requirement", artifact_type="root-requirement"
    )
    work = await _create_artifact(
        client,
        token,
        org_slug,
        project_id,
        artifact_type="workitem",
        title="Dup",
        parent_id=root_requirement_id,
        artifact_key="GH-88",
    )
    artifact_id = work["id"]

    raw = _github_pr_payload(
        html_url="https://github.com/acme/repo/pull/88",
        number=88,
        head_ref="feature/GH-88-x",
    )
    sig = hmac.new(secret.encode("utf-8"), raw, hashlib.sha256).hexdigest()
    headers = {
        "X-GitHub-Event": "pull_request",
        "X-Hub-Signature-256": f"sha256={sig}",
        "Content-Type": "application/json",
    }

    wh1 = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/webhooks/github",
        content=raw,
        headers=headers,
    )
    assert wh1.status_code == 200 and wh1.json()["status"] == "created"

    wh2 = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/webhooks/github",
        content=raw,
        headers=headers,
    )
    assert wh2.status_code == 200 and wh2.json()["status"] == "duplicate"

    links = await client.get(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{artifact_id}/scm-links",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert len(links.json()) == 1


@pytest.mark.asyncio
async def test_github_webhook_bad_signature_401(client: AsyncClient) -> None:
    token = await _register_and_get_token(client, _unique_email(), _unique_org())
    tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
    tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
    project_id = await _ensure_project(client, token, tenant_id)

    secret = "whsec-good"
    patch = await client.patch(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"settings": {"scm_github_webhook_secret": secret}},
    )
    assert patch.status_code == 200, patch.text

    raw = _github_pr_payload(
        html_url="https://github.com/acme/repo/pull/1",
        number=1,
        head_ref="feature/GH-1-x",
    )
    wh = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/webhooks/github",
        content=raw,
        headers={
            "X-GitHub-Event": "pull_request",
            "X-Hub-Signature-256": "sha256=deadbeef",
            "Content-Type": "application/json",
        },
    )
    assert wh.status_code == 401


def _gitlab_mr_payload(
    *,
    web_url: str,
    iid: int,
    source_branch: str,
    title: str = "x",
    description: str = "",
    action: str = "open",
    state: str = "opened",
) -> bytes:
    payload = {
        "object_kind": "merge_request",
        "object_attributes": {
            "action": action,
            "state": state,
            "iid": iid,
            "title": title,
            "description": description,
            "source_branch": source_branch,
            "web_url": web_url,
        },
        "project": {"path_with_namespace": "acme/gitlab-repo"},
    }
    return json.dumps(payload, separators=(",", ":")).encode("utf-8")


@pytest.mark.asyncio
async def test_gitlab_webhook_mr_creates_scm_link(client: AsyncClient) -> None:
    token = await _register_and_get_token(client, _unique_email(), _unique_org())
    tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
    tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
    project_id = await _ensure_project(client, token, tenant_id)

    secret = "gl-secret-token-abc"
    patch = await client.patch(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"settings": {"scm_gitlab_webhook_secret": secret}},
    )
    assert patch.status_code == 200, patch.text

    root_requirement_id = await _root_id(
        client, token, org_slug, project_id, tree="requirement", artifact_type="root-requirement"
    )
    work = await _create_artifact(
        client,
        token,
        org_slug,
        project_id,
        artifact_type="workitem",
        title="GitLab MR story",
        parent_id=root_requirement_id,
        artifact_key="GL-77",
    )
    artifact_id = work["id"]

    raw = _gitlab_mr_payload(
        web_url="https://gitlab.com/acme/gitlab-repo/-/merge_requests/3",
        iid=3,
        source_branch="feature/GL-77-desc",
    )

    wh = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/webhooks/gitlab",
        content=raw,
        headers={
            "X-Gitlab-Event": "Merge Request Hook",
            "X-Gitlab-Token": secret,
            "Content-Type": "application/json",
        },
    )
    assert wh.status_code == 200, wh.text
    assert wh.json()["status"] == "created"

    links = await client.get(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{artifact_id}/scm-links",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert links.status_code == 200
    rows = links.json()
    assert len(rows) == 1
    assert rows[0]["web_url"] == "https://gitlab.com/acme/gitlab-repo/-/merge_requests/3"
    assert rows[0]["source"] == "webhook"
    assert rows[0]["provider"] == "gitlab"
    assert rows[0]["created_by"] is None


@pytest.mark.asyncio
async def test_gitlab_webhook_mr_refs_trailer_sets_task_id(client: AsyncClient) -> None:
    token = await _register_and_get_token(client, _unique_email(), _unique_org())
    tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
    tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
    project_id = await _ensure_project(client, token, tenant_id)

    secret = "gl-secret-refs-trailer"
    patch = await client.patch(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"settings": {"scm_gitlab_webhook_secret": secret}},
    )
    assert patch.status_code == 200, patch.text

    root_requirement_id = await _root_id(
        client, token, org_slug, project_id, tree="requirement", artifact_type="root-requirement"
    )
    work = await _create_artifact(
        client,
        token,
        org_slug,
        project_id,
        artifact_type="workitem",
        title="GitLab MR Refs story",
        parent_id=root_requirement_id,
        artifact_key="GL-88",
    )
    artifact_id = work["id"]

    task_resp = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{artifact_id}/tasks",
        headers={"Authorization": f"Bearer {token}"},
        json={"title": "MR subtask", "description": ""},
    )
    assert task_resp.status_code == 201, task_resp.text
    task_id = task_resp.json()["id"]

    description = f"Desc line.\n\nRefs: {task_id}"
    raw = _gitlab_mr_payload(
        web_url="https://gitlab.com/acme/gitlab-repo/-/merge_requests/88",
        iid=88,
        source_branch="feature/GL-88-branch",
        title="MR with Refs",
        description=description,
    )

    wh = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/webhooks/gitlab",
        content=raw,
        headers={
            "X-Gitlab-Event": "Merge Request Hook",
            "X-Gitlab-Token": secret,
            "Content-Type": "application/json",
        },
    )
    assert wh.status_code == 200, wh.text
    assert wh.json()["status"] == "created"

    links = await client.get(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{artifact_id}/scm-links",
        headers={"Authorization": f"Bearer {token}"},
    )
    rows = links.json()
    assert len(rows) == 1
    assert rows[0]["task_id"] == task_id


@pytest.mark.asyncio
async def test_gitlab_webhook_duplicate_returns_duplicate_status(client: AsyncClient) -> None:
    token = await _register_and_get_token(client, _unique_email(), _unique_org())
    tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
    tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
    project_id = await _ensure_project(client, token, tenant_id)

    secret = "gl-dup-secret"
    patch = await client.patch(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"settings": {"scm_gitlab_webhook_secret": secret}},
    )
    assert patch.status_code == 200, patch.text

    root_requirement_id = await _root_id(
        client, token, org_slug, project_id, tree="requirement", artifact_type="root-requirement"
    )
    work = await _create_artifact(
        client,
        token,
        org_slug,
        project_id,
        artifact_type="workitem",
        title="GL dup",
        parent_id=root_requirement_id,
        artifact_key="GL-66",
    )
    artifact_id = work["id"]

    raw = _gitlab_mr_payload(
        web_url="https://gitlab.com/g/r/-/merge_requests/66",
        iid=66,
        source_branch="feature/GL-66-x",
    )
    headers = {
        "X-Gitlab-Event": "Merge Request Hook",
        "X-Gitlab-Token": secret,
        "Content-Type": "application/json",
    }

    wh1 = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/webhooks/gitlab",
        content=raw,
        headers=headers,
    )
    assert wh1.status_code == 200 and wh1.json()["status"] == "created"

    wh2 = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/webhooks/gitlab",
        content=raw,
        headers=headers,
    )
    assert wh2.status_code == 200 and wh2.json()["status"] == "duplicate"

    links = await client.get(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{artifact_id}/scm-links",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert len(links.json()) == 1


@pytest.mark.asyncio
async def test_gitlab_webhook_bad_token_401(client: AsyncClient) -> None:
    token = await _register_and_get_token(client, _unique_email(), _unique_org())
    tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
    tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
    project_id = await _ensure_project(client, token, tenant_id)

    secret = "gl-good"
    patch = await client.patch(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"settings": {"scm_gitlab_webhook_secret": secret}},
    )
    assert patch.status_code == 200, patch.text

    raw = _gitlab_mr_payload(
        web_url="https://gitlab.com/g/r/-/merge_requests/1",
        iid=1,
        source_branch="feature/GL-1-x",
    )
    wh = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/webhooks/gitlab",
        content=raw,
        headers={
            "X-Gitlab-Event": "Merge Request Hook",
            "X-Gitlab-Token": "wrong",
            "Content-Type": "application/json",
        },
    )
    assert wh.status_code == 401


def _github_push_payload(*, ref: str, commits: list[dict], repo_full: str = "acme/gh-push-repo") -> bytes:
    return json.dumps(
        {"ref": ref, "repository": {"full_name": repo_full}, "commits": commits},
        separators=(",", ":"),
    ).encode("utf-8")


@pytest.mark.asyncio
async def test_github_webhook_push_creates_commit_link(client: AsyncClient) -> None:
    token = await _register_and_get_token(client, _unique_email(), _unique_org())
    tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
    tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
    project_id = await _ensure_project(client, token, tenant_id)

    secret = "whsec-push-test"
    patch = await client.patch(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"settings": {"scm_github_webhook_secret": secret}},
    )
    assert patch.status_code == 200, patch.text

    root_requirement_id = await _root_id(
        client, token, org_slug, project_id, tree="requirement", artifact_type="root-requirement"
    )
    work = await _create_artifact(
        client,
        token,
        org_slug,
        project_id,
        artifact_type="workitem",
        title="Push story",
        parent_id=root_requirement_id,
        artifact_key="GP-101",
    )
    artifact_id = work["id"]

    sha = "abcdef0123456789" * 2 + "abcdef01"  # 40 hex chars
    raw = _github_push_payload(
        ref="refs/heads/feature/GP-101-desc",
        commits=[{"id": sha, "message": "feat(GP-101): push hook", "distinct": True}],
    )
    sig = hmac.new(secret.encode("utf-8"), raw, hashlib.sha256).hexdigest()

    wh = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/webhooks/github",
        content=raw,
        headers={
            "X-GitHub-Event": "push",
            "X-Hub-Signature-256": f"sha256={sig}",
            "Content-Type": "application/json",
        },
    )
    assert wh.status_code == 200, wh.text
    body = wh.json()
    assert body["status"] == "ok"
    assert body["created"] == 1
    assert body["duplicate"] == 0

    links = await client.get(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{artifact_id}/scm-links",
        headers={"Authorization": f"Bearer {token}"},
    )
    rows = links.json()
    assert len(rows) == 1
    assert rows[0]["commit_sha"] == sha.lower()[:64]
    assert rows[0]["provider"] == "github"
    assert "github.com/acme/gh-push-repo/commit/" in rows[0]["web_url"]


@pytest.mark.asyncio
async def test_github_webhook_push_refs_trailer_sets_task_id(client: AsyncClient) -> None:
    token = await _register_and_get_token(client, _unique_email(), _unique_org())
    tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
    tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
    project_id = await _ensure_project(client, token, tenant_id)

    secret = "whsec-push-refs"
    patch = await client.patch(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"settings": {"scm_github_webhook_secret": secret}},
    )
    assert patch.status_code == 200, patch.text

    root_requirement_id = await _root_id(
        client, token, org_slug, project_id, tree="requirement", artifact_type="root-requirement"
    )
    work = await _create_artifact(
        client,
        token,
        org_slug,
        project_id,
        artifact_type="workitem",
        title="Push Refs story",
        parent_id=root_requirement_id,
        artifact_key="GP-202",
    )
    artifact_id = work["id"]

    task_resp = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{artifact_id}/tasks",
        headers={"Authorization": f"Bearer {token}"},
        json={"title": "Commit subtask", "description": ""},
    )
    assert task_resp.status_code == 201, task_resp.text
    task_id = task_resp.json()["id"]

    sha = "0123456789abcdef" * 2 + "01234567"
    msg = f"feat(GP-202): msg\n\nRefs: {task_id}"
    raw = _github_push_payload(
        ref="refs/heads/feature/GP-202-x",
        commits=[{"id": sha, "message": msg, "distinct": True}],
    )
    sig = hmac.new(secret.encode("utf-8"), raw, hashlib.sha256).hexdigest()

    wh = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/webhooks/github",
        content=raw,
        headers={
            "X-GitHub-Event": "push",
            "X-Hub-Signature-256": f"sha256={sig}",
            "Content-Type": "application/json",
        },
    )
    assert wh.status_code == 200, wh.text
    assert wh.json()["created"] == 1

    links = await client.get(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{artifact_id}/scm-links",
        headers={"Authorization": f"Bearer {token}"},
    )
    rows = links.json()
    assert len(rows) == 1
    assert rows[0]["task_id"] == task_id


@pytest.mark.asyncio
async def test_github_webhook_push_duplicate_counts_duplicate(client: AsyncClient) -> None:
    token = await _register_and_get_token(client, _unique_email(), _unique_org())
    tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
    tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
    project_id = await _ensure_project(client, token, tenant_id)

    secret = "whsec-push-dup"
    patch = await client.patch(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"settings": {"scm_github_webhook_secret": secret}},
    )
    assert patch.status_code == 200, patch.text

    root_requirement_id = await _root_id(
        client, token, org_slug, project_id, tree="requirement", artifact_type="root-requirement"
    )
    await _create_artifact(
        client,
        token,
        org_slug,
        project_id,
        artifact_type="workitem",
        title="Push dup",
        parent_id=root_requirement_id,
        artifact_key="GP-202",
    )

    sha = "0123456789abcdef" * 2 + "01234567"
    raw = _github_push_payload(
        ref="refs/heads/feature/GP-202-x",
        commits=[{"id": sha, "message": "GP-202", "distinct": True}],
    )
    sig = hmac.new(secret.encode("utf-8"), raw, hashlib.sha256).hexdigest()
    headers = {
        "X-GitHub-Event": "push",
        "X-Hub-Signature-256": f"sha256={sig}",
        "Content-Type": "application/json",
    }

    wh1 = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/webhooks/github",
        content=raw,
        headers=headers,
    )
    assert wh1.json()["created"] == 1 and wh1.json()["duplicate"] == 0

    wh2 = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/webhooks/github",
        content=raw,
        headers=headers,
    )
    assert wh2.json()["created"] == 0 and wh2.json()["duplicate"] == 1


def _gitlab_push_payload(
    *,
    ref: str,
    commits: list[dict],
    path: str = "acme/gl-push",
    web_url: str = "https://gitlab.com/acme/gl-push",
) -> bytes:
    return json.dumps(
        {
            "object_kind": "push",
            "ref": ref,
            "project": {"path_with_namespace": path, "web_url": web_url},
            "commits": commits,
        },
        separators=(",", ":"),
    ).encode("utf-8")


@pytest.mark.asyncio
async def test_gitlab_webhook_push_creates_commit_link(client: AsyncClient) -> None:
    token = await _register_and_get_token(client, _unique_email(), _unique_org())
    tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
    tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
    project_id = await _ensure_project(client, token, tenant_id)

    secret = "gl-push-secret"
    patch = await client.patch(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"settings": {"scm_gitlab_webhook_secret": secret}},
    )
    assert patch.status_code == 200, patch.text

    root_requirement_id = await _root_id(
        client, token, org_slug, project_id, tree="requirement", artifact_type="root-requirement"
    )
    work = await _create_artifact(
        client,
        token,
        org_slug,
        project_id,
        artifact_type="workitem",
        title="GL push",
        parent_id=root_requirement_id,
        artifact_key="GLP-55",
    )
    artifact_id = work["id"]

    sha = "fedcba9876543210" * 2 + "fedcba98"
    raw = _gitlab_push_payload(
        ref="refs/heads/feature/GLP-55-branch",
        commits=[{"id": sha, "message": "GLP-55: commit"}],
    )

    wh = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/webhooks/gitlab",
        content=raw,
        headers={
            "X-Gitlab-Event": "Push Hook",
            "X-Gitlab-Token": secret,
            "Content-Type": "application/json",
        },
    )
    assert wh.status_code == 200, wh.text
    body = wh.json()
    assert body["status"] == "ok"
    assert body["created"] == 1

    links = await client.get(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{artifact_id}/scm-links",
        headers={"Authorization": f"Bearer {token}"},
    )
    rows = links.json()
    assert len(rows) == 1
    assert rows[0]["commit_sha"] == sha.lower()[:64]
    assert rows[0]["provider"] == "gitlab"
    assert rows[0]["web_url"].endswith(f"/-/commit/{sha.lower()}")


@pytest.mark.asyncio
async def test_gitlab_webhook_push_refs_trailer_sets_task_id(client: AsyncClient) -> None:
    token = await _register_and_get_token(client, _unique_email(), _unique_org())
    tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
    tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
    project_id = await _ensure_project(client, token, tenant_id)

    secret = "gl-push-refs-secret"
    patch = await client.patch(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"settings": {"scm_gitlab_webhook_secret": secret}},
    )
    assert patch.status_code == 200, patch.text

    root_requirement_id = await _root_id(
        client, token, org_slug, project_id, tree="requirement", artifact_type="root-requirement"
    )
    work = await _create_artifact(
        client,
        token,
        org_slug,
        project_id,
        artifact_type="workitem",
        title="GL push Refs",
        parent_id=root_requirement_id,
        artifact_key="GLP-99",
    )
    artifact_id = work["id"]

    task_resp = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{artifact_id}/tasks",
        headers={"Authorization": f"Bearer {token}"},
        json={"title": "Push subtask", "description": ""},
    )
    assert task_resp.status_code == 201, task_resp.text
    task_id = task_resp.json()["id"]

    sha = "abcdef0123456789" * 2 + "abcdef01"
    msg = f"GLP-99: fix\n\nRefs: {task_id}"
    raw = _gitlab_push_payload(
        ref="refs/heads/feature/GLP-99-x",
        commits=[{"id": sha, "message": msg}],
    )

    wh = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/webhooks/gitlab",
        content=raw,
        headers={
            "X-Gitlab-Event": "Push Hook",
            "X-Gitlab-Token": secret,
            "Content-Type": "application/json",
        },
    )
    assert wh.status_code == 200, wh.text
    assert wh.json()["created"] == 1

    links = await client.get(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{artifact_id}/scm-links",
        headers={"Authorization": f"Bearer {token}"},
    )
    rows = links.json()
    assert len(rows) == 1
    assert rows[0]["task_id"] == task_id


@pytest.mark.asyncio
async def test_github_webhook_pr_no_match_persists_unmatched_listable(client: AsyncClient) -> None:
    token = await _register_and_get_token(client, _unique_email(), _unique_org())
    tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
    tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
    project_id = await _ensure_project(client, token, tenant_id)

    secret = "whsec-nomatch"
    patch = await client.patch(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"settings": {"scm_github_webhook_secret": secret}},
    )
    assert patch.status_code == 200, patch.text

    pr_url = "https://github.com/acme/repo/pull/999"
    raw = _github_pr_payload(
        html_url=pr_url,
        number=999,
        head_ref="feature/no-work-item-key",
        title="Plain title without key",
        body="",
    )
    sig = hmac.new(secret.encode("utf-8"), raw, hashlib.sha256).hexdigest()

    wh = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/webhooks/github",
        content=raw,
        headers={
            "X-GitHub-Event": "pull_request",
            "X-Hub-Signature-256": f"sha256={sig}",
            "Content-Type": "application/json",
        },
    )
    assert wh.status_code == 200, wh.text
    assert wh.json()["status"] == "no_match"

    listed = await client.get(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/webhooks/unmatched-events",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert listed.status_code == 200, listed.text
    items = listed.json()
    assert len(items) == 1
    assert items[0]["kind"] == "github_pull_request"
    assert items[0]["provider"] == "github"
    assert items[0]["context"]["web_url"] == pr_url
    assert items[0]["context"]["branch"] == "feature/no-work-item-key"
    assert items[0]["dismissed_at"] is None
    event_id = items[0]["id"]

    bad = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/webhooks/unmatched-events/{event_id}/dismiss",
        headers={"Authorization": "Bearer invalid"},
    )
    assert bad.status_code == 403

    dismiss = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/webhooks/unmatched-events/{event_id}/dismiss",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert dismiss.status_code == 200, dismiss.text
    assert dismiss.json()["dismissed_at"] is not None
    assert dismiss.json()["dismissed_by"] is not None

    open_only = await client.get(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/webhooks/unmatched-events",
        headers={"Authorization": f"Bearer {token}"},
        params={"triage": "open"},
    )
    assert open_only.json() == []

    dismissed_list = await client.get(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/webhooks/unmatched-events",
        headers={"Authorization": f"Bearer {token}"},
        params={"triage": "dismissed"},
    )
    assert len(dismissed_list.json()) == 1

    undismiss = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/webhooks/unmatched-events/{event_id}/undismiss",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert undismiss.status_code == 200, undismiss.text
    assert undismiss.json()["dismissed_at"] is None

    open_again = await client.get(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/webhooks/unmatched-events",
        headers={"Authorization": f"Bearer {token}"},
        params={"triage": "open"},
    )
    assert len(open_again.json()) == 1


@pytest.mark.asyncio
async def test_unmatched_dismiss_unknown_event_returns_404(client: AsyncClient) -> None:
    token = await _register_and_get_token(client, _unique_email(), _unique_org())
    tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
    tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
    project_id = await _ensure_project(client, token, tenant_id)
    bogus_id = str(uuid.uuid4())
    dismiss = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/webhooks/unmatched-events/{bogus_id}/dismiss",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert dismiss.status_code == 404, dismiss.text
    undismiss = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/webhooks/unmatched-events/{bogus_id}/undismiss",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert undismiss.status_code == 404, undismiss.text


@pytest.mark.asyncio
async def test_unmatched_list_triage_dismissed_empty_when_none(client: AsyncClient) -> None:
    token = await _register_and_get_token(client, _unique_email(), _unique_org())
    tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
    tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
    project_id = await _ensure_project(client, token, tenant_id)
    listed = await client.get(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/webhooks/unmatched-events",
        headers={"Authorization": f"Bearer {token}"},
        params={"triage": "dismissed"},
    )
    assert listed.status_code == 200, listed.text
    assert listed.json() == []


@pytest.mark.asyncio
async def test_github_webhook_ping_ok_when_processing_disabled(client: AsyncClient) -> None:
    token = await _register_and_get_token(client, _unique_email(), _unique_org())
    tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
    tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
    project_id = await _ensure_project(client, token, tenant_id)

    secret = "whsec-ping-disabled"
    patch = await client.patch(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "settings": {
                "scm_github_webhook_secret": secret,
                "scm_webhook_github_enabled": False,
            },
        },
    )
    assert patch.status_code == 200, patch.text

    raw = b"{}"
    sig = hmac.new(secret.encode("utf-8"), raw, hashlib.sha256).hexdigest()
    wh = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/webhooks/github",
        content=raw,
        headers={
            "X-GitHub-Event": "ping",
            "X-Hub-Signature-256": f"sha256={sig}",
            "Content-Type": "application/json",
        },
    )
    assert wh.status_code == 200, wh.text
    assert wh.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_github_webhook_push_ignored_when_processing_disabled(client: AsyncClient) -> None:
    token = await _register_and_get_token(client, _unique_email(), _unique_org())
    tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
    tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
    project_id = await _ensure_project(client, token, tenant_id)

    secret = "whsec-push-disabled"
    patch = await client.patch(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "settings": {
                "scm_github_webhook_secret": secret,
                "scm_webhook_github_enabled": False,
            },
        },
    )
    assert patch.status_code == 200, patch.text

    sha = "a" * 40
    raw = _github_push_payload(
        ref="refs/heads/main",
        commits=[{"id": sha, "message": "noop", "distinct": True}],
    )
    sig = hmac.new(secret.encode("utf-8"), raw, hashlib.sha256).hexdigest()
    wh = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/webhooks/github",
        content=raw,
        headers={
            "X-GitHub-Event": "push",
            "X-Hub-Signature-256": f"sha256={sig}",
            "Content-Type": "application/json",
        },
    )
    assert wh.status_code == 200, wh.text
    assert wh.json() == {"status": "ignored", "reason": "disabled"}


@pytest.mark.asyncio
async def test_github_webhook_pr_ignored_when_processing_disabled(client: AsyncClient) -> None:
    token = await _register_and_get_token(client, _unique_email(), _unique_org())
    tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
    tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
    project_id = await _ensure_project(client, token, tenant_id)

    secret = "whsec-pr-disabled"
    patch = await client.patch(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "settings": {
                "scm_github_webhook_secret": secret,
                "scm_webhook_github_enabled": False,
            },
        },
    )
    assert patch.status_code == 200, patch.text

    raw = _github_pr_payload(
        html_url="https://github.com/acme/repo/pull/99",
        number=99,
        head_ref="feature/X-1",
    )
    sig = hmac.new(secret.encode("utf-8"), raw, hashlib.sha256).hexdigest()
    wh = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/webhooks/github",
        content=raw,
        headers={
            "X-GitHub-Event": "pull_request",
            "X-Hub-Signature-256": f"sha256={sig}",
            "Content-Type": "application/json",
        },
    )
    assert wh.status_code == 200, wh.text
    assert wh.json() == {"status": "ignored", "reason": "disabled"}


@pytest.mark.asyncio
async def test_github_webhook_push_ignored_branch_policy(client: AsyncClient) -> None:
    token = await _register_and_get_token(client, _unique_email(), _unique_org())
    tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
    tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
    project_id = await _ensure_project(client, token, tenant_id)

    secret = "whsec-branch-regex"
    patch = await client.patch(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "settings": {
                "scm_github_webhook_secret": secret,
                "scm_webhook_push_branch_regex": r"^feature/",
            },
        },
    )
    assert patch.status_code == 200, patch.text

    sha = "b" * 40
    raw = _github_push_payload(
        ref="refs/heads/main",
        commits=[{"id": sha, "message": "on main", "distinct": True}],
    )
    sig = hmac.new(secret.encode("utf-8"), raw, hashlib.sha256).hexdigest()
    wh = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/webhooks/github",
        content=raw,
        headers={
            "X-GitHub-Event": "push",
            "X-Hub-Signature-256": f"sha256={sig}",
            "Content-Type": "application/json",
        },
    )
    assert wh.status_code == 200, wh.text
    assert wh.json() == {"status": "ignored", "reason": "branch_policy"}


@pytest.mark.asyncio
async def test_github_webhook_push_respects_branch_policy_allow(client: AsyncClient) -> None:
    token = await _register_and_get_token(client, _unique_email(), _unique_org())
    tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
    tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
    project_id = await _ensure_project(client, token, tenant_id)

    secret = "whsec-branch-allow"
    patch = await client.patch(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "settings": {
                "scm_github_webhook_secret": secret,
                "scm_webhook_push_branch_regex": r"^feature/",
            },
        },
    )
    assert patch.status_code == 200, patch.text

    root_requirement_id = await _root_id(
        client, token, org_slug, project_id, tree="requirement", artifact_type="root-requirement"
    )
    work = await _create_artifact(
        client,
        token,
        org_slug,
        project_id,
        artifact_type="workitem",
        title="Branch policy allow",
        parent_id=root_requirement_id,
        artifact_key="BR-77",
    )
    artifact_id = work["id"]

    sha = "c" * 40
    raw = _github_push_payload(
        ref="refs/heads/feature/BR-77-x",
        commits=[{"id": sha, "message": "feat(BR-77): ok", "distinct": True}],
        repo_full="acme/br-policy",
    )
    sig = hmac.new(secret.encode("utf-8"), raw, hashlib.sha256).hexdigest()
    wh = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/webhooks/github",
        content=raw,
        headers={
            "X-GitHub-Event": "push",
            "X-Hub-Signature-256": f"sha256={sig}",
            "Content-Type": "application/json",
        },
    )
    assert wh.status_code == 200, wh.text
    assert wh.json()["status"] == "ok"
    assert wh.json()["created"] == 1

    links = await client.get(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{artifact_id}/scm-links",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert len(links.json()) == 1


@pytest.mark.asyncio
async def test_gitlab_webhook_push_ignored_when_processing_disabled(client: AsyncClient) -> None:
    token = await _register_and_get_token(client, _unique_email(), _unique_org())
    tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
    tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
    project_id = await _ensure_project(client, token, tenant_id)

    secret = "gl-disabled"
    patch = await client.patch(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "settings": {
                "scm_gitlab_webhook_secret": secret,
                "scm_webhook_gitlab_enabled": False,
            },
        },
    )
    assert patch.status_code == 200, patch.text

    sha = "d" * 40
    raw = _gitlab_push_payload(
        ref="refs/heads/main",
        commits=[{"id": sha, "message": "x"}],
    )
    wh = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/webhooks/gitlab",
        content=raw,
        headers={
            "X-Gitlab-Event": "Push Hook",
            "X-Gitlab-Token": secret,
            "Content-Type": "application/json",
        },
    )
    assert wh.status_code == 200, wh.text
    assert wh.json() == {"status": "ignored", "reason": "disabled"}


@pytest.mark.asyncio
async def test_gitlab_webhook_mr_ignored_when_processing_disabled(client: AsyncClient) -> None:
    token = await _register_and_get_token(client, _unique_email(), _unique_org())
    tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
    tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
    project_id = await _ensure_project(client, token, tenant_id)

    secret = "gl-mr-disabled"
    patch = await client.patch(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "settings": {
                "scm_gitlab_webhook_secret": secret,
                "scm_webhook_gitlab_enabled": False,
            },
        },
    )
    assert patch.status_code == 200, patch.text

    raw = _gitlab_mr_payload(
        web_url="https://gitlab.com/acme/r/-/merge_requests/1",
        iid=1,
        source_branch="feature/X",
    )
    wh = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/webhooks/gitlab",
        content=raw,
        headers={
            "X-Gitlab-Event": "Merge Request Hook",
            "X-Gitlab-Token": secret,
            "Content-Type": "application/json",
        },
    )
    assert wh.status_code == 200, wh.text
    assert wh.json() == {"status": "ignored", "reason": "disabled"}


@pytest.mark.asyncio
async def test_gitlab_webhook_push_ignored_branch_policy(client: AsyncClient) -> None:
    token = await _register_and_get_token(client, _unique_email(), _unique_org())
    tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
    tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
    project_id = await _ensure_project(client, token, tenant_id)

    secret = "gl-br-pol"
    patch = await client.patch(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "settings": {
                "scm_gitlab_webhook_secret": secret,
                "scm_webhook_push_branch_regex": r"^release/",
            },
        },
    )
    assert patch.status_code == 200, patch.text

    sha = "e" * 40
    raw = _gitlab_push_payload(
        ref="refs/heads/develop",
        commits=[{"id": sha, "message": "dev"}],
    )
    wh = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/webhooks/gitlab",
        content=raw,
        headers={
            "X-Gitlab-Event": "Push Hook",
            "X-Gitlab-Token": secret,
            "Content-Type": "application/json",
        },
    )
    assert wh.status_code == 200, wh.text
    assert wh.json() == {"status": "ignored", "reason": "branch_policy"}


@pytest.mark.asyncio
async def test_github_webhook_oversized_body_413(client: AsyncClient) -> None:
    token = await _register_and_get_token(client, _unique_email(), _unique_org())
    tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
    tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
    project_id = await _ensure_project(client, token, tenant_id)

    secret = "whsec-oversized"
    patch = await client.patch(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"settings": {"scm_github_webhook_secret": secret}},
    )
    assert patch.status_code == 200, patch.text

    raw = b"x" * (SCM_WEBHOOK_MAX_BODY_BYTES + 1)
    sig = hmac.new(secret.encode("utf-8"), raw, hashlib.sha256).hexdigest()
    wh = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/webhooks/github",
        content=raw,
        headers={
            "X-GitHub-Event": "push",
            "X-Hub-Signature-256": f"sha256={sig}",
            "Content-Type": "application/json",
        },
    )
    assert wh.status_code == 413


@pytest.mark.asyncio
async def test_gitlab_webhook_oversized_body_413(client: AsyncClient) -> None:
    token = await _register_and_get_token(client, _unique_email(), _unique_org())
    tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
    tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
    project_id = await _ensure_project(client, token, tenant_id)

    secret = "gl-oversized"
    patch = await client.patch(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"settings": {"scm_gitlab_webhook_secret": secret}},
    )
    assert patch.status_code == 200, patch.text

    raw = b"y" * (SCM_WEBHOOK_MAX_BODY_BYTES + 1)
    wh = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/webhooks/gitlab",
        content=raw,
        headers={
            "X-Gitlab-Event": "Push Hook",
            "X-Gitlab-Token": secret,
            "Content-Type": "application/json",
        },
    )
    assert wh.status_code == 413


@pytest.mark.asyncio
async def test_github_webhook_same_x_github_delivery_returns_duplicate_delivery(client: AsyncClient) -> None:
    token = await _register_and_get_token(client, _unique_email(), _unique_org())
    tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
    tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
    project_id = await _ensure_project(client, token, tenant_id)

    secret = "whsec-dup-delivery"
    patch = await client.patch(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"settings": {"scm_github_webhook_secret": secret}},
    )
    assert patch.status_code == 200, patch.text

    root_requirement_id = await _root_id(
        client, token, org_slug, project_id, tree="requirement", artifact_type="root-requirement"
    )
    work = await _create_artifact(
        client,
        token,
        org_slug,
        project_id,
        artifact_type="workitem",
        title="Dup delivery",
        parent_id=root_requirement_id,
        artifact_key="DD-1",
    )
    assert work["id"]

    raw = _github_pr_payload(
        html_url="https://github.com/acme/dd-repo/pull/44",
        number=44,
        head_ref="feature/DD-1-x",
    )
    sig = hmac.new(secret.encode("utf-8"), raw, hashlib.sha256).hexdigest()
    delivery = str(uuid.uuid4())
    headers = {
        "X-GitHub-Event": "pull_request",
        "X-Hub-Signature-256": f"sha256={sig}",
        "Content-Type": "application/json",
        "X-GitHub-Delivery": delivery,
    }
    wh1 = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/webhooks/github",
        content=raw,
        headers=headers,
    )
    assert wh1.status_code == 200, wh1.text
    assert wh1.json()["status"] == "created"

    wh2 = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/webhooks/github",
        content=raw,
        headers=headers,
    )
    assert wh2.status_code == 200, wh2.text
    assert wh2.json() == {"status": "ignored", "reason": "duplicate_delivery"}


@pytest.mark.asyncio
async def test_gitlab_webhook_same_x_gitlab_event_uuid_returns_duplicate_delivery(client: AsyncClient) -> None:
    token = await _register_and_get_token(client, _unique_email(), _unique_org())
    tenants = (await client.get("/api/v1/tenants/", headers={"Authorization": f"Bearer {token}"})).json()
    tenant_id, org_slug = tenants[0]["id"], tenants[0]["slug"]
    project_id = await _ensure_project(client, token, tenant_id)

    secret = "gl-dup-uuid"
    patch = await client.patch(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"settings": {"scm_gitlab_webhook_secret": secret}},
    )
    assert patch.status_code == 200, patch.text

    root_requirement_id = await _root_id(
        client, token, org_slug, project_id, tree="requirement", artifact_type="root-requirement"
    )
    work = await _create_artifact(
        client,
        token,
        org_slug,
        project_id,
        artifact_type="workitem",
        title="GL dup",
        parent_id=root_requirement_id,
        artifact_key="GLD-2",
    )
    assert work["id"]

    raw = _gitlab_mr_payload(
        web_url="https://gitlab.com/acme/gl-dup/-/merge_requests/9",
        iid=9,
        source_branch="feature/GLD-2-x",
    )
    event_uuid = str(uuid.uuid4())
    headers = {
        "X-Gitlab-Event": "Merge Request Hook",
        "X-Gitlab-Token": secret,
        "Content-Type": "application/json",
        "X-Gitlab-Event-UUID": event_uuid,
    }
    url = f"/api/v1/orgs/{org_slug}/projects/{project_id}/webhooks/gitlab"
    wh1 = await client.post(url, content=raw, headers=headers)
    assert wh1.status_code == 200, wh1.text
    assert wh1.json()["status"] == "created"

    wh2 = await client.post(url, content=raw, headers=headers)
    assert wh2.status_code == 200, wh2.text
    assert wh2.json() == {"status": "ignored", "reason": "duplicate_delivery"}


@pytest.mark.asyncio
async def test_scm_link_create_accepts_source_ci(client: AsyncClient) -> None:
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
        title="CI link",
        parent_id=root_requirement_id,
    )
    pr_url = "https://github.com/acme/ci-demo/pull/7"
    create = await client.post(
        f"/api/v1/orgs/{org_slug}/projects/{project_id}/artifacts/{work['id']}/scm-links",
        headers={"Authorization": f"Bearer {token}"},
        json={"web_url": pr_url, "source": "ci"},
    )
    assert create.status_code == 201, create.text
    assert create.json()["source"] == "ci"

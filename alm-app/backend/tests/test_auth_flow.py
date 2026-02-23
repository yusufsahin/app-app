"""Integration tests for the complete auth flow."""
from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient


def _unique_email() -> str:
    return f"test-{uuid.uuid4().hex[:12]}@example.com"


def _unique_slug() -> str:
    return f"org-{uuid.uuid4().hex[:8]}"


@pytest.mark.asyncio
class TestRegistration:
    async def test_register_success(self, client: AsyncClient):
        email = _unique_email()
        org = _unique_slug()
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "password": "SecurePass123",
                "display_name": "Test User",
                "org_name": org,
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    async def test_register_duplicate_email(self, client: AsyncClient):
        email = _unique_email()
        org1, org2 = _unique_slug(), _unique_slug()
        await client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "password": "SecurePass123",
                "display_name": "Dup User",
                "org_name": org1,
            },
        )
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "password": "SecurePass123",
                "display_name": "Dup User 2",
                "org_name": org2,
            },
        )
        assert response.status_code == 409


@pytest.mark.asyncio
class TestLogin:
    async def test_login_success(self, client: AsyncClient):
        email = _unique_email()
        org = _unique_slug()
        await client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "password": "SecurePass123",
                "display_name": "Login User",
                "org_name": org,
            },
        )
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": "SecurePass123"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("access_token") is not None or data.get("requires_tenant_selection") is True

    async def test_login_wrong_password(self, client: AsyncClient):
        email = _unique_email()
        org = _unique_slug()
        await client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "password": "SecurePass123",
                "display_name": "Login User",
                "org_name": org,
            },
        )
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": "WrongPass123"},
        )
        assert response.status_code in (401, 403, 422)


@pytest.mark.asyncio
class TestCurrentUser:
    async def test_get_me_authenticated(self, client: AsyncClient):
        email = _unique_email()
        org = _unique_slug()
        reg = await client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "password": "SecurePass123",
                "display_name": "Me User",
                "org_name": org,
            },
        )
        token = reg.json()["access_token"]

        response = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == email
        assert data["display_name"] == "Me User"
        assert isinstance(data["roles"], list)
        assert isinstance(data["permissions"], list)

    async def test_get_me_unauthenticated(self, client: AsyncClient):
        response = await client.get("/api/v1/auth/me")
        assert response.status_code in (401, 403)


@pytest.mark.asyncio
class TestChangePassword:
    async def test_change_password_success(self, client: AsyncClient):
        email = _unique_email()
        org = _unique_slug()
        reg = await client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "password": "OldPass12345",
                "display_name": "PW User",
                "org_name": org,
            },
        )
        token = reg.json()["access_token"]

        response = await client.post(
            "/api/v1/auth/change-password",
            json={"current_password": "OldPass12345", "new_password": "NewPass12345"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200

        login_resp = await client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": "NewPass12345"},
        )
        assert login_resp.status_code == 200

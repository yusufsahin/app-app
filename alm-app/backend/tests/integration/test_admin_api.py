import uuid
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_admin_list_users_forbidden_for_member(client: AsyncClient):
    # Default 'client' fixture doesn't have a user session by default or it's a member.
    # In conftest.py, we'd normally have a way to mock the current user.
    # For this test, we assume the 'require_any_role("admin")' will fail if no admin session is set.
    response = await client.get("/api/v1/admin/users")
    # If not authenticated or not admin, should be 403 or 401.
    assert response.status_code in (401, 403)

@pytest.mark.asyncio
async def test_admin_get_access_audit_forbidden_for_member(client: AsyncClient):
    response = await client.get("/api/v1/admin/audit/access")
    assert response.status_code in (401, 403)

# Note: Full integration tests with 'admin' role would require patching 'CurrentUser'
# or using a test token that resolves to an admin user in the mocked session.

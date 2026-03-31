import uuid
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from alm.admin.api.router import router, _get_access_audit_store
from alm.config.dependencies import get_mediator
from alm.shared.infrastructure.error_handler import register_exception_handlers
from alm.shared.infrastructure.security.dependencies import get_current_user, CurrentUser


@pytest.fixture
def app() -> FastAPI:
    app = FastAPI()
    register_exception_handlers(app)
    app.include_router(router)
    return app


@pytest.fixture
def mock_user() -> CurrentUser:
    return CurrentUser(
        id=uuid.uuid4(),
        tenant_id=uuid.uuid4(),
        roles=["admin"]
    )


@pytest.fixture
def mock_mediator() -> AsyncMock:
    return AsyncMock()


@pytest.fixture
def mock_audit_store() -> AsyncMock:
    return AsyncMock()


@pytest.mark.asyncio
async def test_list_users_success(app: FastAPI, mock_user: CurrentUser, mock_mediator: AsyncMock):
    # Arrange
    from alm.tenant.application.queries.list_users_for_admin import AdminUserSummary
    
    user_id = uuid.uuid4()
    mock_mediator.query.return_value = [
        AdminUserSummary(
            user_id=user_id,
            email="test@example.com",
            display_name="Test User",
            deleted_at=None,
            role_slugs=["member"]
        )
    ]
    
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_mediator] = lambda: mock_mediator
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Act
        response = await client.get("/admin/users")
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["user_id"] == str(user_id)
        assert data[0]["email"] == "test@example.com"


@pytest.mark.asyncio
async def test_create_user_success(app: FastAPI, mock_user: CurrentUser, mock_mediator: AsyncMock):
    # Arrange
    from alm.tenant.application.commands.create_user_by_admin import CreateUserByAdminResult
    
    user_id = uuid.uuid4()
    mock_mediator.send.return_value = CreateUserByAdminResult(
        user_id=user_id,
        email="new@example.com",
        display_name="New User"
    )
    
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_mediator] = lambda: mock_mediator
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Act
        response = await client.post("/admin/users", json={
            "email": "new@example.com",
            "password": "password123",
            "display_name": "New User",
            "role_slug": "member"
        })
        
        # Assert
        assert response.status_code == 201
        data = response.json()
        assert data["user_id"] == str(user_id)
        assert data["email"] == "new@example.com"


@pytest.mark.asyncio
async def test_delete_user_success(app: FastAPI, mock_user: CurrentUser, mock_mediator: AsyncMock):
    # Arrange
    target_user_id = uuid.uuid4()
    mock_mediator.send.return_value = None
    
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_mediator] = lambda: mock_mediator
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Act
        response = await client.delete(f"/admin/users/{target_user_id}")
        
        # Assert
        assert response.status_code == 204
        mock_mediator.send.assert_called_once()


@pytest.mark.asyncio
async def test_get_access_audit_success(app: FastAPI, mock_user: CurrentUser, mock_audit_store: AsyncMock):
    # Arrange
    mock_audit_store.list_entries.return_value = [
        {"timestamp": "2024-01-01T10:00:00", "type": "LOGIN_SUCCESS", "user_email": "test@example.com"}
    ]
    
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[_get_access_audit_store] = lambda: mock_audit_store
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Act
        response = await client.get("/admin/audit/access?from_date=2024-01-01&limit=50")
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["type"] == "LOGIN_SUCCESS"
        mock_audit_store.list_entries.assert_called_once()


@pytest.mark.asyncio
async def test_admin_router_requires_admin_role(app: FastAPI):
    # Arrange
    non_admin_user = CurrentUser(
        id=uuid.uuid4(),
        tenant_id=uuid.uuid4(),
        roles=["member"]
    )
    
    app.dependency_overrides[get_current_user] = lambda: non_admin_user
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Act
        response = await client.get("/admin/users")
        
        # Assert
        assert response.status_code == 403
        assert response.json()["title"] == "Access Denied"

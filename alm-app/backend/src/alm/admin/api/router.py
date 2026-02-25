"""Admin-only API (G5: access audit, G1: create user, G2: list/delete users). Requires admin role in current tenant."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, EmailStr

from alm.admin.infrastructure.access_audit_store import AccessAuditStore
from alm.config.dependencies import get_mediator
from alm.shared.application.mediator import Mediator
from alm.shared.infrastructure.security.dependencies import CurrentUser, require_any_role
from alm.tenant.application.commands.create_user_by_admin import (
    CreateUserByAdmin,
    CreateUserByAdminResult,
)
from alm.tenant.application.commands.soft_delete_user import SoftDeleteUser
from alm.tenant.application.queries.list_users_for_admin import (
    AdminUserSummary,
    ListUsersForAdmin,
)

router = APIRouter(prefix="/admin", tags=["admin"])


class CreateUserByAdminRequest(BaseModel):
    email: EmailStr
    password: str
    display_name: str = ""
    role_slug: str = "member"


class CreateUserByAdminResponse(BaseModel):
    user_id: str
    email: str
    display_name: str


class AdminUserResponse(BaseModel):
    user_id: str
    email: str
    display_name: str
    deleted_at: str | None
    role_slugs: list[str]


def _get_access_audit_store() -> AccessAuditStore:
    return AccessAuditStore()


@router.get("/users", response_model=list[AdminUserResponse])
async def list_users(
    user: Annotated[CurrentUser, Depends(require_any_role("admin"))],
    mediator: Mediator = Depends(get_mediator),
    include_deleted: bool = Query(False),
) -> list[AdminUserResponse]:
    """G2: List users in current tenant. Admin only. Use include_deleted=true to include soft-deleted users."""
    result: list[AdminUserSummary] = await mediator.query(
        ListUsersForAdmin(tenant_id=user.tenant_id, include_deleted=include_deleted)
    )
    return [
        AdminUserResponse(
            user_id=str(u.user_id),
            email=u.email,
            display_name=u.display_name,
            deleted_at=u.deleted_at.isoformat() if u.deleted_at else None,
            role_slugs=u.role_slugs,
        )
        for u in result
    ]


@router.post("/users", response_model=CreateUserByAdminResponse, status_code=201)
async def create_user(
    body: CreateUserByAdminRequest,
    user: Annotated[CurrentUser, Depends(require_any_role("admin"))],
    mediator: Mediator = Depends(get_mediator),
) -> CreateUserByAdminResponse:
    """G1: Create a user in the current tenant (email + password + role). Admin only."""
    result: CreateUserByAdminResult = await mediator.send(
        CreateUserByAdmin(
            tenant_id=user.tenant_id,
            email=body.email,
            password=body.password,
            display_name=body.display_name or body.email,
            role_slug=body.role_slug,
            created_by=user.id,
        )
    )
    return CreateUserByAdminResponse(
        user_id=str(result.user_id),
        email=result.email,
        display_name=result.display_name,
    )


@router.delete("/users/{user_id}", status_code=204)
async def delete_user(
    user_id: uuid.UUID,
    user: Annotated[CurrentUser, Depends(require_any_role("admin"))],
    mediator: Mediator = Depends(get_mediator),
) -> None:
    """G2: Soft-delete a user in the current tenant. Cannot delete self or last admin."""
    await mediator.send(
        SoftDeleteUser(tenant_id=user.tenant_id, user_id=user_id, deleted_by=user.id)
    )


@router.get("/audit/access")
async def get_access_audit(
    _user: Annotated[CurrentUser, Depends(require_any_role("admin"))],
    from_date: str | None = Query(None, description="ISO date (yyyy-MM-dd)"),
    to_date: str | None = Query(None, description="ISO date (yyyy-MM-dd)"),
    type_filter: str | None = Query(None, description="LOGIN_SUCCESS, LOGIN_FAILURE"),
    limit: int = Query(100, ge=1, le=500),
    store: AccessAuditStore = Depends(_get_access_audit_store),
) -> list[dict]:
    """List access audit entries (login success/failure). Admin only."""
    from_ts: datetime | None = None
    to_ts: datetime | None = None
    if from_date:
        try:
            from_ts = datetime.fromisoformat(from_date.replace("Z", "+00:00"))
        except ValueError:
            pass
    if to_date:
        try:
            to_ts = datetime.fromisoformat(to_date.replace("Z", "+00:00"))
        except ValueError:
            pass
    return await store.list_entries(
        from_ts=from_ts,
        to_ts=to_ts,
        type_filter=type_filter,
        limit=limit,
    )

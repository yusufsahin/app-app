from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from alm.auth.api.schemas import (
    ChangePasswordRequest,
    LoginRequest,
    LoginResponse,
    MessageResponse,
    RefreshTokenRequest,
    RegisterRequest,
    SwitchTenantRequest,
    TenantInfoSchema,
    TokenResponse,
    UpdateProfileRequest,
    UserResponse,
)
from alm.auth.application.commands.change_password import ChangePassword
from alm.auth.application.commands.login import Login
from alm.auth.application.commands.refresh_token import RefreshTokenCommand
from alm.auth.application.commands.register import RegisterUser
from alm.auth.application.commands.switch_tenant import SwitchTenant
from alm.auth.application.dtos import CurrentUserDTO, LoginResultDTO, TokenPairDTO
from alm.auth.application.queries.get_current_user import GetCurrentUser
from alm.config.dependencies import get_mediator
from alm.admin.infrastructure.access_audit_store import AccessAuditStore
from alm.shared.application.mediator import Mediator
from alm.shared.domain.exceptions import AccessDenied, ValidationError
from alm.shared.infrastructure.security.dependencies import CurrentUser, get_current_user
from alm.shared.infrastructure.security.jwt import InvalidTokenError, decode_token

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
_bearer = HTTPBearer(auto_error=False)


async def _get_token_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> uuid.UUID:
    """Extract user_id from an access or temp token (for switch-tenant)."""
    if credentials is None:
        raise AccessDenied("Authentication required.")
    try:
        payload = decode_token(credentials.credentials)
    except InvalidTokenError as exc:
        raise AccessDenied(f"Invalid token: {exc}") from exc

    if payload.token_type not in ("access", "tenant_select"):
        raise AccessDenied("Invalid token type.")
    return payload.sub


# ── Public endpoints ──


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(
    body: RegisterRequest,
    mediator: Mediator = Depends(get_mediator),
) -> TokenResponse:
    result: TokenPairDTO = await mediator.send(
        RegisterUser(
            email=body.email,
            password=body.password,
            display_name=body.display_name,
            org_name=body.org_name,
        )
    )
    return TokenResponse(
        access_token=result.access_token,
        refresh_token=result.refresh_token,
        token_type=result.token_type,
    )


def _get_access_audit_store() -> AccessAuditStore:
    return AccessAuditStore()


@router.post("/login", response_model=LoginResponse)
async def login(
    request: Request,
    body: LoginRequest,
    mediator: Mediator = Depends(get_mediator),
    access_audit: AccessAuditStore = Depends(_get_access_audit_store),
) -> LoginResponse:
    client_host = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    try:
        result: LoginResultDTO = await mediator.send(
            Login(email=body.email, password=body.password)
        )
        await access_audit.record_login_success(body.email, client_host, user_agent)
        if result.token_pair is not None:
            return LoginResponse(
                access_token=result.token_pair.access_token,
                refresh_token=result.token_pair.refresh_token,
                token_type=result.token_pair.token_type,
            )
        return LoginResponse(
            requires_tenant_selection=True,
            tenants=[
                TenantInfoSchema(
                    tenant_id=t.tenant_id,
                    tenant_name=t.tenant_name,
                    tenant_slug=t.tenant_slug,
                    roles=t.roles,
                )
                for t in result.tenants
            ],
            temp_token=result.temp_token,
        )
    except (ValidationError, AccessDenied):
        await access_audit.record_login_failure(body.email, client_host, user_agent)
        raise


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    body: RefreshTokenRequest,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    mediator: Mediator = Depends(get_mediator),
) -> TokenResponse:
    tenant_id: uuid.UUID | None = None
    if credentials is not None:
        try:
            payload = decode_token(credentials.credentials)
            tenant_id = payload.tid
        except InvalidTokenError:
            pass

    result: TokenPairDTO = await mediator.send(
        RefreshTokenCommand(
            refresh_token_value=body.refresh_token,
            tenant_id=tenant_id,
        )
    )
    return TokenResponse(
        access_token=result.access_token,
        refresh_token=result.refresh_token,
        token_type=result.token_type,
    )


# ── Authenticated endpoints ──


@router.post("/switch-tenant", response_model=TokenResponse)
async def switch_tenant(
    body: SwitchTenantRequest,
    user_id: uuid.UUID = Depends(_get_token_user_id),
    mediator: Mediator = Depends(get_mediator),
) -> TokenResponse:
    result: TokenPairDTO = await mediator.send(
        SwitchTenant(user_id=user_id, tenant_id=body.tenant_id)
    )
    return TokenResponse(
        access_token=result.access_token,
        refresh_token=result.refresh_token,
        token_type=result.token_type,
    )


@router.get("/me", response_model=UserResponse)
async def get_me(
    user: CurrentUser = Depends(get_current_user),
    mediator: Mediator = Depends(get_mediator),
) -> UserResponse:
    dto: CurrentUserDTO = await mediator.query(
        GetCurrentUser(user_id=user.id, tenant_id=user.tenant_id)
    )
    return UserResponse(
        id=dto.id,
        email=dto.email,
        display_name=dto.display_name,
        is_active=dto.is_active,
        roles=dto.roles,
        permissions=dto.permissions,
    )


@router.put("/me", response_model=UserResponse)
async def update_me(
    body: UpdateProfileRequest,
    user: CurrentUser = Depends(get_current_user),
    mediator: Mediator = Depends(get_mediator),
) -> UserResponse:
    from alm.auth.application.commands.update_profile import UpdateProfile

    dto: CurrentUserDTO = await mediator.send(
        UpdateProfile(
            user_id=user.id,
            tenant_id=user.tenant_id,
            display_name=body.display_name,
        )
    )
    return UserResponse(
        id=dto.id,
        email=dto.email,
        display_name=dto.display_name,
        is_active=dto.is_active,
        roles=dto.roles,
        permissions=dto.permissions,
    )


@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    body: ChangePasswordRequest,
    user: CurrentUser = Depends(get_current_user),
    mediator: Mediator = Depends(get_mediator),
) -> MessageResponse:
    await mediator.send(
        ChangePassword(
            user_id=user.id,
            current_password=body.current_password,
            new_password=body.new_password,
        )
    )
    return MessageResponse(message="Password changed successfully.")

from __future__ import annotations

import uuid

from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=8)
    display_name: str = Field(min_length=1)
    org_name: str = Field(min_length=1)


class LoginRequest(BaseModel):
    email: str
    password: str


class SwitchTenantRequest(BaseModel):
    tenant_id: uuid.UUID


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


class UpdateProfileRequest(BaseModel):
    display_name: str = Field(min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TenantInfoSchema(BaseModel):
    tenant_id: str
    tenant_name: str
    tenant_slug: str
    roles: list[str]


class TenantSelectResponse(BaseModel):
    tenants: list[TenantInfoSchema]
    temp_token: str


class LoginResponse(BaseModel):
    """Union response: either a token pair or a tenant selection prompt."""

    access_token: str | None = None
    refresh_token: str | None = None
    token_type: str = "bearer"
    requires_tenant_selection: bool = False
    tenants: list[TenantInfoSchema] | None = None
    temp_token: str | None = None


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    display_name: str
    is_active: bool
    roles: list[str]
    permissions: list[str]


class MessageResponse(BaseModel):
    message: str

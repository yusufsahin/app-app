from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel


class CreateTenantRequest(BaseModel):
    name: str


class UpdateTenantRequest(BaseModel):
    name: str | None = None
    settings: dict[str, object] | None = None


class TenantResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    tier: str


class TenantWithRolesResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    tier: str
    roles: list[str]


class RoleInfoSchema(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    is_system: bool
    hierarchy_level: int


class PrivilegeSchema(BaseModel):
    id: uuid.UUID
    code: str
    resource: str
    action: str
    description: str


class RoleDetailResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    description: str
    is_system: bool
    hierarchy_level: int
    privileges: list[PrivilegeSchema]


class MemberResponse(BaseModel):
    user_id: uuid.UUID
    email: str
    display_name: str
    roles: list[RoleInfoSchema]
    joined_at: datetime | None = None


class InviteMemberRequest(BaseModel):
    email: str
    role_ids: list[uuid.UUID]


class AcceptInviteRequest(BaseModel):
    token: str


class AssignRolesRequest(BaseModel):
    role_ids: list[uuid.UUID]


class AddRoleRequest(BaseModel):
    role_id: uuid.UUID


class CreateRoleRequest(BaseModel):
    name: str
    slug: str
    description: str = ""
    hierarchy_level: int = 100
    privilege_ids: list[uuid.UUID] = []


class UpdateRoleRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    hierarchy_level: int | None = None


class SetRolePrivilegesRequest(BaseModel):
    privilege_ids: list[uuid.UUID]


class InvitationResponse(BaseModel):
    id: uuid.UUID
    email: str
    roles: list[RoleInfoSchema]
    expires_at: datetime
    accepted_at: datetime | None

"""G2: List tenant users for admin (with optional include_deleted)."""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime

from alm.shared.application.query import Query, QueryHandler
from alm.tenant.domain.ports import (
    MembershipRepository,
    RoleRepository,
    UserLookupPort,
)


@dataclass(frozen=True)
class AdminUserSummary:
    user_id: uuid.UUID
    email: str
    display_name: str
    deleted_at: datetime | None
    role_slugs: list[str]


@dataclass(frozen=True)
class ListUsersForAdmin(Query):
    tenant_id: uuid.UUID
    include_deleted: bool = False


class ListUsersForAdminHandler(QueryHandler[list[AdminUserSummary]]):
    def __init__(
        self,
        membership_repo: MembershipRepository,
        role_repo: RoleRepository,
        user_lookup: UserLookupPort,
    ) -> None:
        self._membership_repo = membership_repo
        self._role_repo = role_repo
        self._user_lookup = user_lookup

    async def handle(self, query: Query) -> list[AdminUserSummary]:
        assert isinstance(query, ListUsersForAdmin)
        memberships = await self._membership_repo.find_all_by_tenant(query.tenant_id)
        result: list[AdminUserSummary] = []
        for membership in memberships:
            user_info = await self._user_lookup.find_by_id(
                membership.user_id, include_deleted=query.include_deleted
            )
            if user_info is None:
                continue
            if not query.include_deleted and user_info.deleted_at is not None:
                continue
            role_ids = await self._membership_repo.get_role_ids(membership.id)
            role_slugs: list[str] = []
            for role_id in role_ids:
                role = await self._role_repo.find_by_id(role_id)
                if role is not None:
                    role_slugs.append(role.slug)
            result.append(
                AdminUserSummary(
                    user_id=user_info.id,
                    email=user_info.email,
                    display_name=user_info.display_name,
                    deleted_at=user_info.deleted_at,
                    role_slugs=role_slugs,
                )
            )
        return result

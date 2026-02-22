from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, cast

from alm.auth.application.dtos import CurrentUserDTO
from alm.shared.application.query import Query, QueryHandler
from alm.shared.domain.exceptions import AccessDenied, EntityNotFound

if TYPE_CHECKING:
    import uuid

    from alm.auth.domain.ports import UserRepository
    from alm.tenant.domain.ports import MembershipRepository, RoleRepository


@dataclass(frozen=True)
class GetCurrentUser(Query):
    user_id: uuid.UUID
    tenant_id: uuid.UUID


class GetCurrentUserHandler(QueryHandler[CurrentUserDTO]):
    def __init__(
        self,
        user_repo: UserRepository,
        membership_repo: MembershipRepository,
        role_repo: RoleRepository,
    ) -> None:
        self._user_repo = user_repo
        self._membership_repo = membership_repo
        self._role_repo = role_repo

    async def handle(self, query: Query) -> CurrentUserDTO:
        q = cast("GetCurrentUser", query)

        user = await self._user_repo.find_by_id(q.user_id)
        if user is None:
            raise EntityNotFound("User", q.user_id)

        membership = await self._membership_repo.find_by_user_and_tenant(q.user_id, q.tenant_id)
        if membership is None:
            raise AccessDenied("User is not a member of the current tenant.")

        role_slugs = await self._role_repo.get_role_slugs_for_membership(membership.id)

        role_ids = await self._membership_repo.get_role_ids(membership.id)
        permissions = await self._role_repo.get_privilege_codes_for_roles(role_ids)

        return CurrentUserDTO(
            id=user.id,
            email=user.email,
            display_name=user.display_name,
            is_active=user.is_active,
            roles=role_slugs,
            permissions=permissions,
        )

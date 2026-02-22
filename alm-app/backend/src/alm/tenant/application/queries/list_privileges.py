from __future__ import annotations

from dataclasses import dataclass

from alm.shared.application.query import Query, QueryHandler
from alm.tenant.application.dtos import PrivilegeDTO
from alm.tenant.domain.ports import PrivilegeRepository


@dataclass(frozen=True)
class ListPrivileges(Query):
    pass


class ListPrivilegesHandler(QueryHandler[list[PrivilegeDTO]]):
    def __init__(self, privilege_repo: PrivilegeRepository) -> None:
        self._privilege_repo = privilege_repo

    async def handle(self, query: Query) -> list[PrivilegeDTO]:
        privileges = await self._privilege_repo.find_all()
        return [
            PrivilegeDTO(
                id=p.id,
                code=p.code,
                resource=p.resource,
                action=p.action,
                description=p.description,
            )
            for p in privileges
        ]

"""Team repository port (P6)."""

from __future__ import annotations

import uuid
from abc import abstractmethod

from alm.team.domain.entities import Team, TeamMember


class TeamRepository:
    @abstractmethod
    async def find_by_id(self, team_id: uuid.UUID) -> Team | None: ...

    @abstractmethod
    async def list_by_project(self, project_id: uuid.UUID) -> list[Team]: ...

    @abstractmethod
    async def add(self, team: Team) -> Team: ...

    @abstractmethod
    async def update(self, team: Team) -> Team: ...

    @abstractmethod
    async def delete(self, team_id: uuid.UUID) -> bool: ...

    @abstractmethod
    async def list_members(self, team_id: uuid.UUID) -> list[TeamMember]: ...

    @abstractmethod
    async def add_member(self, member: TeamMember) -> None: ...

    @abstractmethod
    async def remove_member(self, team_id: uuid.UUID, user_id: uuid.UUID) -> bool: ...

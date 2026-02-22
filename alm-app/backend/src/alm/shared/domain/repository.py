from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from typing import Generic, TypeVar

from alm.shared.domain.entity import BaseEntity

T = TypeVar("T", bound=BaseEntity)


class Repository(ABC, Generic[T]):
    @abstractmethod
    async def find_by_id(self, id: uuid.UUID, *, include_deleted: bool = False) -> T | None: ...

    @abstractmethod
    async def find_all(self, *, include_deleted: bool = False) -> list[T]: ...

    @abstractmethod
    async def add(self, entity: T) -> T: ...

    @abstractmethod
    async def update(self, entity: T) -> T: ...

    @abstractmethod
    async def soft_delete(self, id: uuid.UUID, deleted_by: uuid.UUID) -> None: ...

    @abstractmethod
    async def restore(self, id: uuid.UUID) -> None: ...

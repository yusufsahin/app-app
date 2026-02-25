"""Unit of Work port — DDD Enterprise Clean Architecture.

Coordinates the work of repositories and ensures transactional consistency.
All changes within a UoW are committed or rolled back atomically.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


class IUnitOfWork(ABC):
    """Port for Unit of Work. Abstracts transactional boundary."""

    @abstractmethod
    async def commit(self) -> None:
        """Persist all changes and close the transaction."""
        ...

    @abstractmethod
    async def rollback(self) -> None:
        """Discard all changes and close the transaction."""
        ...

    @property
    @abstractmethod
    def session(self) -> "AsyncSession":
        """Underlying session for repository implementations."""
        ...

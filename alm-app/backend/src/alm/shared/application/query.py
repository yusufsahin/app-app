from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Generic, TypeVar

R = TypeVar("R")


@dataclass(frozen=True)
class Query:
    pass


class QueryHandler(ABC, Generic[R]):
    @abstractmethod
    async def handle(self, query: Query) -> R: ...

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import TypeVar

R = TypeVar("R")


@dataclass(frozen=True)
class Query:
    pass


class QueryHandler[R](ABC):
    @abstractmethod
    async def handle(self, query: Query) -> R: ...

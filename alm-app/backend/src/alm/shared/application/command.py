from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Generic, TypeVar

R = TypeVar("R")


@dataclass(frozen=True)
class Command:
    pass


class CommandHandler(ABC, Generic[R]):
    @abstractmethod
    async def handle(self, command: Command) -> R: ...

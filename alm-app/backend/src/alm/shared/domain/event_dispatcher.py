"""Domain Event Dispatcher port — DDD Enterprise Clean Architecture.

Enables event-driven side effects: handlers can react to domain events
(e.g. send notification, update read model, trigger integration).
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Awaitable, Callable

from alm.shared.domain.events import DomainEvent

DomainEventHandler = Callable[[DomainEvent], Awaitable[Any]]


class IDomainEventDispatcher(ABC):
    """Port for dispatching domain events to registered handlers."""

    @abstractmethod
    async def dispatch(self, events: list[DomainEvent]) -> None:
        """Dispatch events to all registered handlers for each event type."""
        ...

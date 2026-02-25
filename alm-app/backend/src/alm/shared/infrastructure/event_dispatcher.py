"""Domain Event Dispatcher implementation — DDD Enterprise Clean Architecture."""
from __future__ import annotations

import structlog

from alm.shared.domain.event_dispatcher import (
    IDomainEventDispatcher,
    DomainEventHandler,
)
from alm.shared.domain.events import DomainEvent

logger = structlog.get_logger()

_event_handlers: dict[type[DomainEvent], list[DomainEventHandler]] = {}


def register_event_handler(
    event_type: type[DomainEvent],
    handler: DomainEventHandler,
) -> None:
    """Register a handler for a specific event type."""
    _event_handlers.setdefault(event_type, []).append(handler)


def _get_handler_types(event: DomainEvent) -> list[type[DomainEvent]]:
    """Return event type and base DomainEvent for handler lookup."""
    cls = type(event)
    return [cls, DomainEvent] if cls is not DomainEvent else [DomainEvent]


class DomainEventDispatcher(IDomainEventDispatcher):
    """Dispatches domain events to registered handlers. Handlers run in registration order."""

    async def dispatch(self, events: list[DomainEvent]) -> None:
        for event in events:
            for handler_type in _get_handler_types(event):
                handlers = _event_handlers.get(handler_type, [])
                for handler in handlers:
                    try:
                        await handler(event)
                    except Exception:
                        logger.exception(
                            "event_handler_failed",
                            event_type=type(event).__name__,
                            handler=handler.__qualname__,
                        )
                        raise

from __future__ import annotations

from alm.shared.domain.entity import BaseEntity
from alm.shared.domain.events import DomainEvent


class AggregateRoot(BaseEntity):
    def _register_event(self, event: DomainEvent) -> None:
        self._events.append(event)

    def collect_events(self) -> list[DomainEvent]:
        events = list(self._events)
        self._events.clear()
        return events

from __future__ import annotations

from typing import Any, Callable

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from alm.shared.application.command import Command, CommandHandler
from alm.shared.application.query import Query, QueryHandler
from alm.shared.domain.events import DomainEvent
from alm.shared.domain.event_dispatcher import IDomainEventDispatcher

logger = structlog.get_logger()

HandlerFactory = Callable[[AsyncSession], CommandHandler[Any] | QueryHandler[Any]]

_command_factories: dict[type[Command], Callable[[AsyncSession], CommandHandler[Any]]] = {}
_query_factories: dict[type[Query], Callable[[AsyncSession], QueryHandler[Any]]] = {}

SESSION_EVENTS_KEY = "_domain_events"

_domain_event_dispatcher: IDomainEventDispatcher | None = None


def set_domain_event_dispatcher(dispatcher: IDomainEventDispatcher) -> None:
    """Set the domain event dispatcher used by Mediator. Call at startup."""
    global _domain_event_dispatcher
    _domain_event_dispatcher = dispatcher


def register_command_handler(
    command_type: type[Command],
    factory: Callable[[AsyncSession], CommandHandler[Any]],
) -> None:
    _command_factories[command_type] = factory


def register_query_handler(
    query_type: type[Query],
    factory: Callable[[AsyncSession], QueryHandler[Any]],
) -> None:
    _query_factories[query_type] = factory


def buffer_event(session: AsyncSession, event: DomainEvent) -> None:
    """Append a domain event to the session-scoped buffer.
    Called by repositories after add/update to collect aggregate events."""
    session.info.setdefault(SESSION_EVENTS_KEY, []).append(event)


def buffer_events(session: AsyncSession, events: list[DomainEvent]) -> None:
    session.info.setdefault(SESSION_EVENTS_KEY, []).extend(events)


class Mediator:
    """Session-scoped mediator. Lazily creates handlers via registered factories.
    After command execution, collects domain events from the session buffer."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._session.info.setdefault(SESSION_EVENTS_KEY, [])

    async def send(self, command: Command) -> Any:
        factory = _command_factories.get(type(command))
        if factory is None:
            raise ValueError(f"No handler registered for command {type(command).__name__}")
        handler = factory(self._session)
        result = await handler.handle(command)
        await self._process_audit()
        await self._session.commit()
        await self._dispatch_collected_events()
        return result

    async def query(self, query: Query) -> Any:
        factory = _query_factories.get(type(query))
        if factory is None:
            raise ValueError(f"No handler registered for query {type(query).__name__}")
        handler = factory(self._session)
        return await handler.handle(query)

    async def _process_audit(self) -> None:
        from alm.shared.audit.interceptor import AuditInterceptor

        interceptor = AuditInterceptor(self._session)
        await interceptor.process()

    async def _dispatch_collected_events(self) -> None:
        events: list[DomainEvent] = self._session.info.pop(SESSION_EVENTS_KEY, [])
        self._session.info[SESSION_EVENTS_KEY] = []
        if events:
            logger.info(
                "domain_events_dispatched",
                count=len(events),
                types=[type(e).__name__ for e in events],
            )
            if _domain_event_dispatcher is not None:
                await _domain_event_dispatcher.dispatch(events)

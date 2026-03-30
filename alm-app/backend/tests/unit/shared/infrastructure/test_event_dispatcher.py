from __future__ import annotations

from dataclasses import dataclass
from unittest.mock import AsyncMock, patch

import pytest

from alm.shared.domain.events import DomainEvent
from alm.shared.infrastructure import event_dispatcher as dispatcher_module
from alm.shared.infrastructure.event_dispatcher import (
    DomainEventDispatcher,
    _get_handler_types,
    register_event_handler,
)


@dataclass(frozen=True, kw_only=True)
class SampleEvent(DomainEvent):
    name: str


class TestEventDispatcher:
    def setup_method(self) -> None:
        dispatcher_module._event_handlers.clear()

    def test_get_handler_types_for_subclass(self) -> None:
        event = SampleEvent(name="x")
        types = _get_handler_types(event)
        assert types == [SampleEvent, DomainEvent]

    def test_get_handler_types_for_base_event(self) -> None:
        event = DomainEvent()
        types = _get_handler_types(event)
        assert types == [DomainEvent]

    @pytest.mark.asyncio
    async def test_dispatch_calls_specific_and_base_handlers_in_order(self) -> None:
        specific = AsyncMock()
        base = AsyncMock()

        register_event_handler(SampleEvent, specific)
        register_event_handler(DomainEvent, base)

        event = SampleEvent(name="hello")
        await DomainEventDispatcher().dispatch([event])

        specific.assert_awaited_once_with(event)
        base.assert_awaited_once_with(event)

    @pytest.mark.asyncio
    async def test_dispatch_logs_and_reraises_on_handler_failure(self) -> None:
        async def bad(_: DomainEvent) -> None:
            raise RuntimeError("boom")

        register_event_handler(SampleEvent, bad)

        event = SampleEvent(name="bad")

        with patch("alm.shared.infrastructure.event_dispatcher.logger.exception") as log_exception:
            with pytest.raises(RuntimeError, match="boom"):
                await DomainEventDispatcher().dispatch([event])

        log_exception.assert_called_once()

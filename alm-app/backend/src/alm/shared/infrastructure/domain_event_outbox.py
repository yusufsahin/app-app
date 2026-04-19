"""Transactional outbox for domain events — persist with the DB transaction, dispatch after commit."""

from __future__ import annotations

import asyncio
import importlib
import uuid
from dataclasses import asdict, fields, is_dataclass
from datetime import UTC, datetime, timedelta
from types import UnionType
from typing import Any, Union, get_args, get_origin, get_type_hints

import structlog
from sqlalchemy import DateTime, Integer, String, Text, Uuid, delete, func, text, update
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.orm import Mapped, mapped_column

from alm.config.settings import settings
from alm.shared.domain.events import DomainEvent
from alm.shared.infrastructure.db.base_model import Base
from alm.shared.infrastructure.outbox_metrics import (
    alm_domain_event_outbox_dead_letter_requeued_total,
    alm_domain_event_outbox_dispatched_total,
    alm_domain_event_outbox_exhausted_rows,
    alm_domain_event_outbox_pending_rows,
    alm_domain_event_outbox_retry_scheduled_total,
    alm_domain_event_outbox_sync_cleared_total,
)
from alm.shared.infrastructure.outbox_queries import (
    OUTBOX_AGGREGATE_ROW_COUNTS_SQL,
    REQUEUE_EXHAUSTED_OUTBOX_ROWS_SQL,
)

logger = structlog.get_logger()

OUTBOX_ROW_IDS_SESSION_KEY = "_domain_event_outbox_row_ids"

_ALLOWED_EVENT_TYPE_PREFIX = "alm."

_CLAIM_NEXT_SQL = """
WITH cte AS (
  SELECT id FROM domain_event_outbox
  WHERE attempts < :max_attempts
    AND (next_attempt_at IS NULL OR next_attempt_at <= NOW())
    AND (locked_until IS NULL OR locked_until < NOW())
  ORDER BY created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
UPDATE domain_event_outbox AS o
SET locked_until = :lease_until
FROM cte
WHERE o.id = cte.id
RETURNING
  o.id,
  o.event_type,
  o.payload,
  o.created_at,
  o.attempts,
  o.last_error,
  o.next_attempt_at,
  o.locked_until
"""


class DomainEventOutboxModel(Base):
    """Stores serialized domain events until handlers succeed (same transaction as aggregates on insert)."""

    __tablename__ = "domain_event_outbox"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    event_type: Mapped[str] = mapped_column(String(512), nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    next_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


def _sanitize_for_json(obj: Any) -> Any:
    if isinstance(obj, uuid.UUID):
        return str(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, dict):
        return {str(k): _sanitize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize_for_json(v) for v in obj]
    return obj


def domain_event_to_payload(event: DomainEvent) -> dict[str, Any]:
    cls = type(event)
    fqcn = f"{cls.__module__}.{cls.__qualname__}"
    return {"event_type": fqcn, "fields": _sanitize_for_json(asdict(event))}


def _strip_optional(annotation: Any) -> Any:
    origin = get_origin(annotation)
    args = get_args(annotation)
    if origin is Union or origin is UnionType:
        filtered = [a for a in args if a is not type(None)]
        if len(filtered) == 1:
            return filtered[0]
    return annotation


def _coerce_simple(annotation: Any, value: Any) -> Any:
    if value is None:
        return None
    ann = _strip_optional(annotation)
    origin = get_origin(ann)
    if origin is list:
        (inner,) = get_args(ann)
        if not isinstance(value, list):
            msg = f"expected list, got {type(value).__name__}"
            raise TypeError(msg)
        return [_coerce_simple(inner, item) for item in value]
    if ann is uuid.UUID:
        return uuid.UUID(str(value))
    if ann is datetime:
        if isinstance(value, datetime):
            return value
        s = str(value).replace("Z", "+00:00")
        return datetime.fromisoformat(s)
    if ann is int:
        return int(value)
    if ann is str:
        return str(value)
    if ann is bool:
        return bool(value)
    msg = f"unsupported field type for outbox coercion: {ann!r}"
    raise TypeError(msg)


def payload_to_domain_event(payload: dict[str, Any]) -> DomainEvent:
    fqcn = payload["event_type"]
    raw_fields = payload["fields"]
    cls = import_event_class(fqcn)
    hints = get_type_hints(cls)
    kwargs: dict[str, Any] = {}
    for f in fields(cls):
        if f.name not in raw_fields:
            continue
        tp = hints.get(f.name, f.type)
        kwargs[f.name] = _coerce_simple(tp, raw_fields[f.name])
    return cls(**kwargs)


def import_event_class(fqcn: str) -> type[DomainEvent]:
    if not fqcn.startswith(_ALLOWED_EVENT_TYPE_PREFIX):
        msg = f"disallowed event type prefix: {fqcn!r}"
        raise ValueError(msg)
    module_path, dot, name = fqcn.rpartition(".")
    if not dot:
        msg = f"invalid event type {fqcn!r}"
        raise ValueError(msg)
    module = importlib.import_module(module_path)
    cls = getattr(module, name)
    if not (is_dataclass(cls) and issubclass(cls, DomainEvent)):
        msg = f"not a DomainEvent dataclass: {fqcn!r}"
        raise TypeError(msg)
    return cls


async def persist_buffered_domain_events(session: AsyncSession) -> None:
    """Insert one outbox row per buffered session event (same transaction as upcoming commit)."""
    from alm.shared.application.mediator import SESSION_EVENTS_KEY

    events: list[DomainEvent] = session.info.get(SESSION_EVENTS_KEY) or []
    if not events:
        session.info.pop(OUTBOX_ROW_IDS_SESSION_KEY, None)
        return

    row_ids: list[uuid.UUID] = []
    for event in events:
        packed = domain_event_to_payload(event)
        row = DomainEventOutboxModel(
            id=uuid.uuid4(),
            event_type=packed["event_type"],
            payload=packed,
        )
        session.add(row)
        row_ids.append(row.id)

    session.info[OUTBOX_ROW_IDS_SESSION_KEY] = row_ids
    await session.flush()


async def delete_synced_outbox_rows(session: AsyncSession, row_ids: list[uuid.UUID]) -> None:
    if not row_ids:
        return
    await session.execute(delete(DomainEventOutboxModel).where(DomainEventOutboxModel.id.in_(row_ids)))
    alm_domain_event_outbox_sync_cleared_total.inc(len(row_ids))


def _retry_delay_seconds(attempts: int) -> float:
    capped = min(attempts, 12)
    return min(3600.0, 5.0 * (2**capped))


async def claim_next_outbox_row(
    session_factory: async_sessionmaker[AsyncSession],
) -> dict[str, Any] | None:
    """Atomically lock one eligible row for dispatch (PostgreSQL FOR UPDATE SKIP LOCKED)."""
    lease_until = datetime.now(UTC) + timedelta(seconds=settings.domain_event_outbox_lease_seconds)
    max_attempts = settings.domain_event_outbox_max_attempts
    async with session_factory() as session, session.begin():
        result = await session.execute(
            text(_CLAIM_NEXT_SQL),
            {"lease_until": lease_until, "max_attempts": max_attempts},
        )
        row = result.mappings().first()
    return dict(row) if row else None


async def _delete_outbox_row(session_factory: async_sessionmaker[AsyncSession], row_id: uuid.UUID) -> None:
    async with session_factory() as session:
        await session.execute(delete(DomainEventOutboxModel).where(DomainEventOutboxModel.id == row_id))
        await session.commit()


async def _mark_outbox_dispatch_failed(
    session_factory: async_sessionmaker[AsyncSession],
    row: dict[str, Any],
    exc: Exception,
) -> None:
    attempts_before = int(row["attempts"])
    new_attempts = attempts_before + 1
    delay = _retry_delay_seconds(new_attempts)
    next_at = datetime.now(UTC) + timedelta(seconds=delay)
    async with session_factory() as session:
        await session.execute(
            update(DomainEventOutboxModel)
            .where(DomainEventOutboxModel.id == row["id"])
            .values(
                locked_until=None,
                attempts=new_attempts,
                last_error=repr(exc)[:4000],
                next_attempt_at=next_at,
            )
        )
        await session.commit()


async def refresh_outbox_prometheus_gauges(session_factory: async_sessionmaker[AsyncSession]) -> None:
    """Refresh ``alm_domain_event_outbox_pending_rows`` and ``alm_domain_event_outbox_exhausted_rows`` from the DB."""
    async with session_factory() as session:
        result = await session.execute(
            text(OUTBOX_AGGREGATE_ROW_COUNTS_SQL),
            {"max_attempts": settings.domain_event_outbox_max_attempts},
        )
        row = result.mappings().one()
        await session.commit()
    alm_domain_event_outbox_pending_rows.set(float(row["total"] or 0))
    alm_domain_event_outbox_exhausted_rows.set(float(row["exhausted"] or 0))


async def requeue_exhausted_outbox_rows(
    session_factory: async_sessionmaker[AsyncSession],
    *,
    limit: int,
) -> int:
    """Reset the oldest ``limit`` rows with ``attempts >= max_attempts`` so the worker retries them.

    The outbox table is not tenant-scoped; this affects the whole database. Call only from a trusted admin path.
    """
    if limit < 1:
        return 0
    cap = min(limit, settings.domain_event_outbox_requeue_max_per_request)
    max_a = settings.domain_event_outbox_max_attempts
    async with session_factory() as session:
        result = await session.execute(
            text(REQUEUE_EXHAUSTED_OUTBOX_ROWS_SQL),
            {"max_attempts": max_a, "requeue_limit": cap},
        )
        rows = result.fetchall()
        await session.commit()
    n = len(rows)
    if n > 0:
        alm_domain_event_outbox_dead_letter_requeued_total.inc(n)
        logger.info(
            "domain_event_outbox_dead_letter_requeued",
            count=n,
            requested_limit=limit,
            effective_cap=cap,
        )
        try:
            await refresh_outbox_prometheus_gauges(session_factory)
        except Exception:
            logger.exception("domain_event_outbox_gauge_refresh_after_requeue_failed")
    return n


async def process_pending_outbox_batch(session_factory: async_sessionmaker[AsyncSession]) -> int:
    """Dispatch up to batch_size pending rows using one row claim per iteration. Returns rows attempted."""
    from alm.shared.application.mediator import get_domain_event_dispatcher

    processed = 0
    try:
        dispatcher = get_domain_event_dispatcher()
        if dispatcher is None:
            return 0

        batch_size = settings.domain_event_outbox_batch_size

        for _ in range(batch_size):
            row = await claim_next_outbox_row(session_factory)
            if row is None:
                break

            processed += 1
            oid = uuid.UUID(str(row["id"]))
            et = str(row["event_type"])

            try:
                event = payload_to_domain_event(row["payload"])
                await dispatcher.dispatch([event])
            except Exception as exc:
                logger.exception(
                    "domain_event_outbox_dispatch_failed",
                    outbox_id=str(oid),
                    event_type=et,
                    attempts_before=row["attempts"],
                )
                await _mark_outbox_dispatch_failed(session_factory, row, exc)
                alm_domain_event_outbox_retry_scheduled_total.inc()
                continue

            await _delete_outbox_row(session_factory, oid)
            alm_domain_event_outbox_dispatched_total.inc()
            logger.info(
                "domain_event_outbox_dispatched",
                outbox_id=str(oid),
                event_type=et,
            )

        return processed
    finally:
        try:
            await refresh_outbox_prometheus_gauges(session_factory)
        except Exception:
            logger.exception("domain_event_outbox_gauge_refresh_failed")


async def run_domain_event_outbox_worker(session_factory: async_sessionmaker[AsyncSession]) -> None:
    interval = settings.domain_event_outbox_poll_interval_seconds
    if interval <= 0:
        logger.info("domain_event_outbox_worker_disabled", reason="poll_interval_seconds<=0")
        return

    while True:
        try:
            await process_pending_outbox_batch(session_factory)
        except Exception:
            logger.exception("domain_event_outbox_batch_failed")
        await asyncio.sleep(interval)

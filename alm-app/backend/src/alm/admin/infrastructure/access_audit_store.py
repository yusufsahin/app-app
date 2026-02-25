"""Store for access audit entries (G5). Records login success/failure; can be called from auth router."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from alm.admin.infrastructure.models import AccessAuditModel
from alm.shared.infrastructure.db.session import async_session_factory


class AccessAuditStore:
    """Append-only store for access audit. Uses its own session per call."""

    async def record_login_success(self, email: str, ip: str | None, user_agent: str | None) -> None:
        await self._insert("LOGIN_SUCCESS", email, ip, user_agent)

    async def record_login_failure(self, email: str, ip: str | None, user_agent: str | None) -> None:
        await self._insert("LOGIN_FAILURE", email or "unknown", ip, user_agent)

    async def _insert(
        self,
        audit_type: str,
        email: str,
        ip: str | None,
        user_agent: str | None,
    ) -> None:
        async with async_session_factory() as session:
            model = AccessAuditModel(
                id=uuid.uuid4(),
                type=audit_type,
                email=email or None,
                ip=(ip or "")[:64] if ip else None,
                user_agent=(user_agent or "")[:512] if user_agent else None,
            )
            session.add(model)
            await session.commit()

    async def list_entries(
        self,
        from_ts: datetime | None = None,
        to_ts: datetime | None = None,
        type_filter: str | None = None,
        limit: int = 100,
    ) -> list[dict]:
        async with async_session_factory() as session:
            q = select(AccessAuditModel).order_by(AccessAuditModel.timestamp.desc())
            if from_ts is not None:
                q = q.where(AccessAuditModel.timestamp >= from_ts)
            if to_ts is not None:
                q = q.where(AccessAuditModel.timestamp <= to_ts)
            if type_filter:
                q = q.where(AccessAuditModel.type == type_filter)
            q = q.limit(min(limit, 500))
            result = await session.execute(q)
            return [
                {
                    "id": str(row.id),
                    "timestamp": row.timestamp.isoformat() if row.timestamp else None,
                    "type": row.type,
                    "email": row.email,
                    "ip": row.ip,
                    "user_agent": row.user_agent,
                }
                for row in result.scalars().all()
            ]

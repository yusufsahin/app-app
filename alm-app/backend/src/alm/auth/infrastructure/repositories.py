from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from alm.auth.domain.entities import RefreshToken, User
from alm.auth.domain.ports import RefreshTokenRepository, UserRepository
from alm.auth.infrastructure.models import RefreshTokenModel, UserModel
from alm.shared.application.mediator import buffer_events
from alm.shared.audit.core import ChangeType
from alm.shared.audit.interceptor import buffer_audit
from alm.tenant.domain.ports import UserInfo, UserLookupPort


class SqlAlchemyUserRepository(UserRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def find_by_id(self, user_id: uuid.UUID, include_deleted: bool = False) -> User | None:
        q = select(UserModel).where(UserModel.id == user_id)
        if not include_deleted:
            q = q.where(UserModel.deleted_at.is_(None))
        result = await self._session.execute(q)
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def find_by_email(self, email: str) -> User | None:
        result = await self._session.execute(
            select(UserModel).where(UserModel.email == email, UserModel.deleted_at.is_(None))
        )
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def add(self, user: User) -> User:
        model = UserModel(
            id=user.id,
            email=user.email,
            display_name=user.display_name,
            password_hash=user.password_hash,
            is_active=user.is_active,
            email_verified=user.email_verified,
        )
        self._session.add(model)
        await self._session.flush()
        buffer_events(self._session, user.collect_events())
        buffer_audit(self._session, "User", user.id, user.to_snapshot_dict(), ChangeType.INITIAL)
        return user

    async def update(self, user: User) -> User:
        await self._session.execute(
            update(UserModel)
            .where(UserModel.id == user.id)
            .values(
                email=user.email,
                display_name=user.display_name,
                password_hash=user.password_hash,
                is_active=user.is_active,
                email_verified=user.email_verified,
            )
        )
        await self._session.flush()
        buffer_events(self._session, user.collect_events())
        buffer_audit(self._session, "User", user.id, user.to_snapshot_dict(), ChangeType.UPDATE)
        return user

    async def find_all(self, include_deleted: bool = False) -> list[User]:
        q = select(UserModel)
        if not include_deleted:
            q = q.where(UserModel.deleted_at.is_(None))
        result = await self._session.execute(q)
        return [self._to_entity(m) for m in result.scalars().all()]

    async def soft_delete(self, user_id: uuid.UUID, deleted_by: uuid.UUID) -> None:
        await self._session.execute(
            update(UserModel).where(UserModel.id == user_id).values(deleted_at=datetime.now(UTC), deleted_by=deleted_by)
        )
        await self._session.flush()

    @staticmethod
    def _to_entity(model: UserModel) -> User:
        user = User(
            email=model.email,
            display_name=model.display_name,
            password_hash=model.password_hash,
            id=model.id,
            is_active=model.is_active,
            email_verified=model.email_verified,
        )
        user.created_at = model.created_at
        user.created_by = model.created_by
        user.updated_at = model.updated_at
        user.updated_by = model.updated_by
        user.deleted_at = model.deleted_at
        user.deleted_by = model.deleted_by
        return user


class SqlAlchemyRefreshTokenRepository(RefreshTokenRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, token: RefreshToken) -> RefreshToken:
        model = RefreshTokenModel(
            id=token.id,
            user_id=token.user_id,
            token_hash=token.token_hash,
            expires_at=token.expires_at,
        )
        self._session.add(model)
        await self._session.flush()
        buffer_audit(self._session, "RefreshToken", token.id, token.to_snapshot_dict(), ChangeType.INITIAL)
        return token

    async def find_by_token_hash(self, token_hash: str) -> RefreshToken | None:
        result = await self._session.execute(
            select(RefreshTokenModel).where(RefreshTokenModel.token_hash == token_hash)
        )
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def revoke(self, token: RefreshToken) -> None:
        await self._session.execute(
            update(RefreshTokenModel).where(RefreshTokenModel.id == token.id).values(revoked_at=token.revoked_at)
        )
        await self._session.flush()
        buffer_audit(self._session, "RefreshToken", token.id, token.to_snapshot_dict(), ChangeType.UPDATE)

    async def revoke_all_for_user(self, user_id: uuid.UUID) -> None:
        await self._session.execute(
            update(RefreshTokenModel)
            .where(
                RefreshTokenModel.user_id == user_id,
                RefreshTokenModel.revoked_at.is_(None),
            )
            .values(revoked_at=datetime.now(UTC))
        )
        await self._session.flush()

    @staticmethod
    def _to_entity(model: RefreshTokenModel) -> RefreshToken:
        token = RefreshToken(
            user_id=model.user_id,
            token_hash=model.token_hash,
            expires_at=model.expires_at,
            id=model.id,
        )
        token.revoked_at = model.revoked_at
        token.created_at = model.created_at
        token.created_by = model.created_by
        token.updated_at = model.updated_at
        token.updated_by = model.updated_by
        return token


class SqlAlchemyUserLookupAdapter(UserLookupPort):
    """Adapter that fulfils Tenant BC's UserLookupPort via Auth infrastructure."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def find_by_id(self, user_id: uuid.UUID, include_deleted: bool = False) -> UserInfo | None:
        q = select(UserModel).where(UserModel.id == user_id)
        if not include_deleted:
            q = q.where(UserModel.deleted_at.is_(None))
        result = await self._session.execute(q)
        model = result.scalar_one_or_none()
        if model is None:
            return None
        return UserInfo(
            id=model.id,
            email=model.email,
            display_name=model.display_name,
            deleted_at=model.deleted_at,
        )

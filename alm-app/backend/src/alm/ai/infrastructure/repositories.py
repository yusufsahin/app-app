"""SQLAlchemy repository implementation for AI module."""

from __future__ import annotations

import uuid

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from alm.ai.domain.entities import AiConversation, AiInsight, AiMessage, AiPendingAction, AiProviderConfig
from alm.ai.domain.ports import IAiRepository
from alm.ai.domain.value_objects import (
    AutonomyLevel,
    InsightSeverity,
    InsightType,
    MessageRole,
    PendingActionStatus,
)
from alm.ai.infrastructure.models import (
    AiConversationModel,
    AiInsightModel,
    AiMessageModel,
    AiPendingActionModel,
    AiProviderConfigModel,
)


class SqlAlchemyAiRepository(IAiRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    # ── Provider configs ──

    async def get_provider_config(self, config_id: uuid.UUID) -> AiProviderConfig | None:
        result = await self._session.execute(
            select(AiProviderConfigModel).where(AiProviderConfigModel.id == config_id)
        )
        m = result.scalar_one_or_none()
        return self._provider_to_entity(m) if m else None

    async def get_default_provider_config(self, tenant_id: uuid.UUID) -> AiProviderConfig | None:
        result = await self._session.execute(
            select(AiProviderConfigModel).where(
                AiProviderConfigModel.tenant_id == tenant_id,
                AiProviderConfigModel.is_default.is_(True),
                AiProviderConfigModel.is_enabled.is_(True),
            )
        )
        m = result.scalar_one_or_none()
        if m:
            return self._provider_to_entity(m)
        # Fallback: first enabled provider for tenant
        result2 = await self._session.execute(
            select(AiProviderConfigModel).where(
                AiProviderConfigModel.tenant_id == tenant_id,
                AiProviderConfigModel.is_enabled.is_(True),
            ).limit(1)
        )
        m2 = result2.scalar_one_or_none()
        return self._provider_to_entity(m2) if m2 else None

    async def list_provider_configs(self, tenant_id: uuid.UUID) -> list[AiProviderConfig]:
        result = await self._session.execute(
            select(AiProviderConfigModel)
            .where(AiProviderConfigModel.tenant_id == tenant_id)
            .order_by(AiProviderConfigModel.created_at.asc())
        )
        return [self._provider_to_entity(m) for m in result.scalars().all()]

    async def save_provider_config(self, config: AiProviderConfig) -> AiProviderConfig:
        existing = await self._session.get(AiProviderConfigModel, config.id)
        if existing:
            existing.name = config.name
            existing.provider = config.provider
            existing.model = config.model
            existing.encrypted_api_key = config.encrypted_api_key
            existing.base_url = config.base_url
            existing.is_default = config.is_default
            existing.is_enabled = config.is_enabled
        else:
            self._session.add(AiProviderConfigModel(
                id=config.id,
                tenant_id=config.tenant_id,
                name=config.name,
                provider=config.provider,
                model=config.model,
                encrypted_api_key=config.encrypted_api_key,
                base_url=config.base_url,
                is_default=config.is_default,
                is_enabled=config.is_enabled,
            ))
        await self._session.flush()
        return config

    async def delete_provider_config(self, config_id: uuid.UUID) -> None:
        m = await self._session.get(AiProviderConfigModel, config_id)
        if m:
            await self._session.delete(m)
            await self._session.flush()

    # ── Conversations ──

    async def get_conversation(self, conversation_id: uuid.UUID) -> AiConversation | None:
        m = await self._session.get(AiConversationModel, conversation_id)
        return self._conversation_to_entity(m) if m else None

    async def list_conversations(
        self,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID,
        project_id: uuid.UUID | None = None,
    ) -> list[AiConversation]:
        stmt = select(AiConversationModel).where(
            AiConversationModel.tenant_id == tenant_id,
            AiConversationModel.user_id == user_id,
        )
        if project_id:
            stmt = stmt.where(AiConversationModel.project_id == project_id)
        stmt = stmt.order_by(AiConversationModel.created_at.desc()).limit(50)
        result = await self._session.execute(stmt)
        return [self._conversation_to_entity(m) for m in result.scalars().all()]

    async def save_conversation(self, conversation: AiConversation) -> AiConversation:
        existing = await self._session.get(AiConversationModel, conversation.id)
        if existing:
            existing.title = conversation.title
            existing.autonomy_level = conversation.autonomy_level
            existing.provider_config_id = conversation.provider_config_id
        else:
            self._session.add(AiConversationModel(
                id=conversation.id,
                tenant_id=conversation.tenant_id,
                project_id=conversation.project_id,
                user_id=conversation.user_id,
                provider_config_id=conversation.provider_config_id,
                autonomy_level=conversation.autonomy_level,
                title=conversation.title,
                artifact_context_id=conversation.artifact_context_id,
            ))
        await self._session.flush()
        return conversation

    # ── Messages ──

    async def list_messages(self, conversation_id: uuid.UUID) -> list[AiMessage]:
        result = await self._session.execute(
            select(AiMessageModel)
            .where(AiMessageModel.conversation_id == conversation_id)
            .order_by(AiMessageModel.created_at.asc())
        )
        return [self._message_to_entity(m) for m in result.scalars().all()]

    async def save_message(self, message: AiMessage) -> AiMessage:
        self._session.add(AiMessageModel(
            id=message.id,
            conversation_id=message.conversation_id,
            role=message.role,
            content=message.content,
            tool_calls=message.tool_calls,
            tool_results=message.tool_results,
        ))
        await self._session.flush()
        return message

    # ── Pending actions ──

    async def list_pending_actions(
        self,
        conversation_id: uuid.UUID,
        status: PendingActionStatus | None = None,
    ) -> list[AiPendingAction]:
        stmt = select(AiPendingActionModel).where(
            AiPendingActionModel.conversation_id == conversation_id
        )
        if status:
            stmt = stmt.where(AiPendingActionModel.status == status)
        result = await self._session.execute(stmt.order_by(AiPendingActionModel.created_at.asc()))
        return [self._pending_to_entity(m) for m in result.scalars().all()]

    async def get_pending_action(self, action_id: uuid.UUID) -> AiPendingAction | None:
        m = await self._session.get(AiPendingActionModel, action_id)
        return self._pending_to_entity(m) if m else None

    async def save_pending_action(self, action: AiPendingAction) -> AiPendingAction:
        existing = await self._session.get(AiPendingActionModel, action.id)
        if existing:
            existing.status = action.status
            existing.executed_result = action.executed_result
        else:
            self._session.add(AiPendingActionModel(
                id=action.id,
                conversation_id=action.conversation_id,
                message_id=action.message_id,
                tool_name=action.tool_name,
                tool_args=action.tool_args,
                status=action.status,
                executed_result=action.executed_result,
            ))
        await self._session.flush()
        return action

    # ── Insights ──

    async def list_insights(
        self,
        tenant_id: uuid.UUID,
        project_id: uuid.UUID,
        include_dismissed: bool = False,
    ) -> list[AiInsight]:
        stmt = select(AiInsightModel).where(
            AiInsightModel.tenant_id == tenant_id,
            AiInsightModel.project_id == project_id,
        )
        if not include_dismissed:
            stmt = stmt.where(AiInsightModel.is_dismissed.is_(False))
        result = await self._session.execute(stmt.order_by(AiInsightModel.created_at.desc()))
        return [self._insight_to_entity(m) for m in result.scalars().all()]

    async def save_insight(self, insight: AiInsight) -> AiInsight:
        self._session.add(AiInsightModel(
            id=insight.id,
            tenant_id=insight.tenant_id,
            project_id=insight.project_id,
            insight_type=insight.insight_type,
            severity=insight.severity,
            title=insight.title,
            body=insight.body,
            context=insight.context,
            is_dismissed=insight.is_dismissed,
        ))
        await self._session.flush()
        return insight

    async def dismiss_insight(self, insight_id: uuid.UUID) -> None:
        await self._session.execute(
            update(AiInsightModel)
            .where(AiInsightModel.id == insight_id)
            .values(is_dismissed=True)
        )
        await self._session.flush()

    # ── Mappers ──

    @staticmethod
    def _provider_to_entity(m: AiProviderConfigModel) -> AiProviderConfig:
        return AiProviderConfig(
            id=m.id,
            tenant_id=m.tenant_id,
            name=m.name,
            provider=m.provider,
            model=m.model,
            encrypted_api_key=m.encrypted_api_key,
            base_url=m.base_url,
            is_default=m.is_default,
            is_enabled=m.is_enabled,
            created_at=m.created_at,
            updated_at=m.updated_at,
        )

    @staticmethod
    def _conversation_to_entity(m: AiConversationModel) -> AiConversation:
        return AiConversation(
            id=m.id,
            tenant_id=m.tenant_id,
            project_id=m.project_id,
            user_id=m.user_id,
            provider_config_id=m.provider_config_id,
            autonomy_level=AutonomyLevel(m.autonomy_level),
            title=m.title,
            artifact_context_id=m.artifact_context_id,
            created_at=m.created_at,
            updated_at=m.updated_at,
        )

    @staticmethod
    def _message_to_entity(m: AiMessageModel) -> AiMessage:
        return AiMessage(
            id=m.id,
            conversation_id=m.conversation_id,
            role=MessageRole(m.role),
            content=m.content,
            tool_calls=m.tool_calls,
            tool_results=m.tool_results,
            created_at=m.created_at,
        )

    @staticmethod
    def _pending_to_entity(m: AiPendingActionModel) -> AiPendingAction:
        return AiPendingAction(
            id=m.id,
            conversation_id=m.conversation_id,
            message_id=m.message_id,
            tool_name=m.tool_name,
            tool_args=m.tool_args or {},
            status=PendingActionStatus(m.status),
            executed_result=m.executed_result,
            created_at=m.created_at,
            updated_at=m.updated_at,
        )

    @staticmethod
    def _insight_to_entity(m: AiInsightModel) -> AiInsight:
        return AiInsight(
            id=m.id,
            tenant_id=m.tenant_id,
            project_id=m.project_id,
            insight_type=InsightType(m.insight_type),
            severity=InsightSeverity(m.severity),
            title=m.title,
            body=m.body,
            context=m.context or {},
            is_dismissed=m.is_dismissed,
            created_at=m.created_at,
        )

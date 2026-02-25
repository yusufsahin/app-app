"""Unit tests for permitted-transitions query and transition-by-trigger command."""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock

import pytest

from alm.artifact.application.commands.transition_artifact import (
    TransitionArtifact,
    TransitionArtifactHandler,
)
from alm.artifact.application.queries.get_permitted_transitions import (
    GetPermittedTransitions,
    GetPermittedTransitionsHandler,
    PermittedTransitionDTO,
)
from alm.artifact.domain.entities import Artifact
from alm.shared.domain.exceptions import PolicyDeniedError, ValidationError


class _NoOpTransitionMetrics:
    def record_duration_seconds(self, duration: float) -> None:
        pass

    def record_result(self, result: str) -> None:
        pass


# Minimal project-like object
class _Project:
    def __init__(self, tenant_id: uuid.UUID, process_template_version_id: uuid.UUID | None):
        self.tenant_id = tenant_id
        self.process_template_version_id = process_template_version_id


# Minimal process template version with manifest
class _Version:
    def __init__(self, id: uuid.UUID, manifest_bundle: dict):
        self.id = id
        self.manifest_bundle = manifest_bundle


MANIFEST_WITH_TRIGGER_LABEL = {
    "defs": [
        {
            "kind": "Workflow",
            "id": "basic",
            "initial": "new",
            "states": ["new", "active", "resolved"],
            "transitions": [
                {"from": "new", "to": "active", "trigger": "start", "trigger_label": "Start"},
                {"from": "active", "to": "resolved", "trigger": "resolve", "trigger_label": "Resolve"},
            ],
        },
        {"kind": "ArtifactType", "id": "requirement", "workflow_id": "basic"},
    ],
}

# Manifest with TransitionPolicy: assignee required when entering "active"
MANIFEST_WITH_ASSIGNEE_POLICY = {
    "defs": [
        {
            "kind": "Workflow",
            "id": "basic",
            "initial": "new",
            "states": ["new", "active", "resolved"],
            "transitions": [
                {"from": "new", "to": "active"},
                {"from": "active", "to": "resolved"},
            ],
        },
        {"kind": "ArtifactType", "id": "requirement", "workflow_id": "basic"},
        {"kind": "TransitionPolicy", "id": "assignee_active", "when": {"state": "active"}, "require": "assignee"},
    ],
}


@pytest.fixture
def tenant_id():
    return uuid.uuid4()


@pytest.fixture
def project_id():
    return uuid.uuid4()


@pytest.fixture
def version_id():
    return uuid.uuid4()


@pytest.fixture
def artifact_id():
    return uuid.uuid4()


@pytest.mark.asyncio
class TestGetPermittedTransitionsHandler:
    """Test permitted-transitions query returns trigger, to_state, label from manifest."""

    async def test_returns_label_from_manifest_trigger_label(
        self, tenant_id: uuid.UUID, project_id: uuid.UUID, artifact_id: uuid.UUID, version_id: uuid.UUID
    ):
        artifact = Artifact.create(
            project_id=project_id,
            artifact_type="requirement",
            title="Req",
            state="new",
            id=artifact_id,
        )
        project = _Project(tenant_id=tenant_id, process_template_version_id=version_id)
        version = _Version(version_id, MANIFEST_WITH_TRIGGER_LABEL)

        artifact_repo = AsyncMock()
        artifact_repo.find_by_id = AsyncMock(return_value=artifact)
        project_repo = AsyncMock()
        project_repo.find_by_id = AsyncMock(return_value=project)
        process_repo = AsyncMock()
        process_repo.find_version_by_id = AsyncMock(return_value=version)

        handler = GetPermittedTransitionsHandler(
            artifact_repo=artifact_repo,
            project_repo=project_repo,
            process_template_repo=process_repo,
        )
        query = GetPermittedTransitions(
            tenant_id=tenant_id,
            project_id=project_id,
            artifact_id=artifact_id,
        )
        result = await handler.handle(query)

        assert len(result) == 1
        dto = result[0]
        assert isinstance(dto, PermittedTransitionDTO)
        assert dto.trigger == "start"
        assert dto.to_state == "active"
        assert dto.label == "Start"

    async def test_returns_empty_when_project_has_no_template(
        self, tenant_id: uuid.UUID, project_id: uuid.UUID, artifact_id: uuid.UUID
    ):
        artifact = Artifact.create(
            project_id=project_id,
            artifact_type="requirement",
            title="Req",
            state="new",
            id=artifact_id,
        )
        project = _Project(tenant_id=tenant_id, process_template_version_id=None)
        artifact_repo = AsyncMock()
        artifact_repo.find_by_id = AsyncMock(return_value=artifact)
        project_repo = AsyncMock()
        project_repo.find_by_id = AsyncMock(return_value=project)
        process_repo = AsyncMock()

        handler = GetPermittedTransitionsHandler(
            artifact_repo=artifact_repo,
            project_repo=project_repo,
            process_template_repo=process_repo,
        )
        query = GetPermittedTransitions(
            tenant_id=tenant_id,
            project_id=project_id,
            artifact_id=artifact_id,
        )
        result = await handler.handle(query)
        assert result == []


@pytest.mark.asyncio
class TestTransitionArtifactHandlerWithTrigger:
    """Test transition command resolves trigger to to_state and updates artifact."""

    async def test_trigger_resolved_to_state_and_artifact_updated(
        self, tenant_id: uuid.UUID, project_id: uuid.UUID, artifact_id: uuid.UUID, version_id: uuid.UUID
    ):
        artifact = Artifact.create(
            project_id=project_id,
            artifact_type="requirement",
            title="Req",
            state="new",
            id=artifact_id,
        )
        project = _Project(tenant_id=tenant_id, process_template_version_id=version_id)
        version = _Version(version_id, MANIFEST_WITH_TRIGGER_LABEL)

        artifact_repo = AsyncMock()
        artifact_repo.find_by_id = AsyncMock(return_value=artifact)
        artifact_repo.update = AsyncMock(side_effect=lambda a: a)
        project_repo = AsyncMock()
        project_repo.find_by_id = AsyncMock(return_value=project)
        process_repo = AsyncMock()
        process_repo.find_version_by_id = AsyncMock(return_value=version)

        handler = TransitionArtifactHandler(
            artifact_repo=artifact_repo,
            project_repo=project_repo,
            process_template_repo=process_repo,
            metrics=_NoOpTransitionMetrics(),
        )
        command = TransitionArtifact(
            tenant_id=tenant_id,
            project_id=project_id,
            artifact_id=artifact_id,
            new_state=None,
            trigger="start",
            updated_by=tenant_id,
        )
        dto = await handler.handle(command)

        assert dto.state == "active"
        artifact_repo.update.assert_called_once()
        updated = artifact_repo.update.call_args[0][0]
        assert updated.state == "active"

    async def test_trigger_not_permitted_raises_validation_error(
        self, tenant_id: uuid.UUID, project_id: uuid.UUID, artifact_id: uuid.UUID, version_id: uuid.UUID
    ):
        artifact = Artifact.create(
            project_id=project_id,
            artifact_type="requirement",
            title="Req",
            state="new",
            id=artifact_id,
        )
        project = _Project(tenant_id=tenant_id, process_template_version_id=version_id)
        version = _Version(version_id, MANIFEST_WITH_TRIGGER_LABEL)

        artifact_repo = AsyncMock()
        artifact_repo.find_by_id = AsyncMock(return_value=artifact)
        project_repo = AsyncMock()
        project_repo.find_by_id = AsyncMock(return_value=project)
        process_repo = AsyncMock()
        process_repo.find_version_by_id = AsyncMock(return_value=version)

        handler = TransitionArtifactHandler(
            artifact_repo=artifact_repo,
            project_repo=project_repo,
            process_template_repo=process_repo,
            metrics=_NoOpTransitionMetrics(),
        )
        command = TransitionArtifact(
            tenant_id=tenant_id,
            project_id=project_id,
            artifact_id=artifact_id,
            new_state=None,
            trigger="nonexistent_trigger",
            updated_by=tenant_id,
        )
        with pytest.raises(ValidationError) as exc_info:
            await handler.handle(command)
        assert "not permitted" in str(exc_info.value).lower() or "trigger" in str(exc_info.value).lower()

    async def test_neither_trigger_nor_new_state_raises(
        self, tenant_id: uuid.UUID, project_id: uuid.UUID, artifact_id: uuid.UUID
    ):
        artifact = Artifact.create(
            project_id=project_id,
            artifact_type="requirement",
            title="Req",
            state="new",
            id=artifact_id,
        )
        project = _Project(tenant_id=tenant_id, process_template_version_id=uuid.uuid4())
        artifact_repo = AsyncMock()
        artifact_repo.find_by_id = AsyncMock(return_value=artifact)
        project_repo = AsyncMock()
        project_repo.find_by_id = AsyncMock(return_value=project)
        process_repo = AsyncMock()

        handler = TransitionArtifactHandler(
            artifact_repo=artifact_repo,
            project_repo=project_repo,
            process_template_repo=process_repo,
            metrics=_NoOpTransitionMetrics(),
        )
        command = TransitionArtifact(
            tenant_id=tenant_id,
            project_id=project_id,
            artifact_id=artifact_id,
            new_state=None,
            trigger=None,
        )
        with pytest.raises(ValidationError) as exc_info:
            await handler.handle(command)
        assert "trigger" in str(exc_info.value).lower() or "new_state" in str(exc_info.value).lower()

    async def test_policy_violation_raises_policy_denied_error(
        self, tenant_id: uuid.UUID, project_id: uuid.UUID, artifact_id: uuid.UUID, version_id: uuid.UUID
    ):
        """When transition is valid per workflow but TransitionPolicy fails (e.g. assignee required), handler raises PolicyDeniedError."""
        artifact = Artifact.create(
            project_id=project_id,
            artifact_type="requirement",
            title="Req",
            state="new",
            id=artifact_id,
        )
        assert artifact.assignee_id is None
        project = _Project(tenant_id=tenant_id, process_template_version_id=version_id)
        version = _Version(version_id, MANIFEST_WITH_ASSIGNEE_POLICY)

        artifact_repo = AsyncMock()
        artifact_repo.find_by_id = AsyncMock(return_value=artifact)
        project_repo = AsyncMock()
        project_repo.find_by_id = AsyncMock(return_value=project)
        process_repo = AsyncMock()
        process_repo.find_version_by_id = AsyncMock(return_value=version)

        handler = TransitionArtifactHandler(
            artifact_repo=artifact_repo,
            project_repo=project_repo,
            process_template_repo=process_repo,
            metrics=_NoOpTransitionMetrics(),
        )
        command = TransitionArtifact(
            tenant_id=tenant_id,
            project_id=project_id,
            artifact_id=artifact_id,
            new_state="active",
            trigger=None,
            updated_by=tenant_id,
        )
        with pytest.raises(PolicyDeniedError) as exc_info:
            await handler.handle(command)
        assert "assignee" in str(exc_info.value).lower()

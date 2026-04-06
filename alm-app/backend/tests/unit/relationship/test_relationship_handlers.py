from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from alm.artifact.domain.entities import Artifact
from alm.relationship.application.commands.delete_relationship import (
    DeleteRelationship,
    DeleteRelationshipHandler,
)
from alm.relationship.application.commands.reorder_relationships import (
    ReorderOutgoingRelationships,
    ReorderOutgoingRelationshipsHandler,
)
from alm.relationship.application.queries.get_artifact_impact_analysis import (
    GetArtifactImpactAnalysis,
    GetArtifactImpactAnalysisHandler,
)
from alm.relationship.application.queries.list_relationships_for_artifact import (
    ListRelationshipsForArtifact,
    ListRelationshipsForArtifactHandler,
)
from alm.relationship.domain.entities import Relationship
from alm.shared.domain.exceptions import ValidationError


@pytest.mark.asyncio
async def test_reorder_relationships_rejects_unordered_type() -> None:
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    artifact_id = uuid.uuid4()

    project = MagicMock()
    project.tenant_id = tenant_id

    project_repo = AsyncMock()
    project_repo.find_by_id = AsyncMock(return_value=project)
    relationship_repo = AsyncMock()

    handler = ReorderOutgoingRelationshipsHandler(
        relationship_repo=relationship_repo,
        project_repo=project_repo,
    )

    with pytest.raises(ValidationError, match="does not support ordering"):
        await handler.handle(
            ReorderOutgoingRelationships(
                tenant_id=tenant_id,
                project_id=project_id,
                source_artifact_id=artifact_id,
                relationship_type="verifies",
                ordered_relationship_ids=[],
            )
        )

    relationship_repo.list_outgoing_relationship_ids.assert_not_called()
    relationship_repo.set_sort_orders_for_outgoing.assert_not_called()


@pytest.mark.asyncio
async def test_reorder_relationships_rejects_mismatched_id_set() -> None:
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    artifact_id = uuid.uuid4()
    rel_a = uuid.uuid4()
    rel_b = uuid.uuid4()

    project = MagicMock()
    project.tenant_id = tenant_id

    project_repo = AsyncMock()
    project_repo.find_by_id = AsyncMock(return_value=project)
    relationship_repo = AsyncMock()
    relationship_repo.list_outgoing_relationship_ids = AsyncMock(return_value=[rel_a, rel_b])

    handler = ReorderOutgoingRelationshipsHandler(
        relationship_repo=relationship_repo,
        project_repo=project_repo,
    )

    with pytest.raises(ValidationError, match="ordered_relationship_ids must contain exactly"):
        await handler.handle(
            ReorderOutgoingRelationships(
                tenant_id=tenant_id,
                project_id=project_id,
                source_artifact_id=artifact_id,
                relationship_type="suite_includes_test",
                ordered_relationship_ids=[rel_a],
            )
        )

    relationship_repo.set_sort_orders_for_outgoing.assert_not_called()


@pytest.mark.asyncio
async def test_delete_relationship_rejects_other_artifact_scope() -> None:
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    artifact_id = uuid.uuid4()
    other_artifact_id = uuid.uuid4()
    relationship_id = uuid.uuid4()

    relationship = Relationship.create(
        project_id=project_id,
        source_artifact_id=uuid.uuid4(),
        target_artifact_id=other_artifact_id,
        relationship_type="blocks",
        id=relationship_id,
    )

    relationship_repo = AsyncMock()
    relationship_repo.find_by_id = AsyncMock(return_value=relationship)

    handler = DeleteRelationshipHandler(relationship_repo=relationship_repo)

    with pytest.raises(ValidationError, match="does not belong to this artifact"):
        await handler.handle(
            DeleteRelationship(
                tenant_id=tenant_id,
                project_id=project_id,
                artifact_id=artifact_id,
                relationship_id=relationship_id,
            )
        )

    relationship_repo.delete.assert_not_called()


@pytest.mark.asyncio
async def test_list_relationships_for_artifact_builds_incoming_and_outgoing_views() -> None:
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    current_id = uuid.uuid4()
    target_id = uuid.uuid4()
    source_id = uuid.uuid4()

    project = MagicMock()
    project.tenant_id = tenant_id

    current_artifact = Artifact.create(
        project_id=project_id,
        artifact_type="test-case",
        title="Current Artifact",
        state="active",
        id=current_id,
        artifact_key="TC-1",
    )
    target_artifact = Artifact.create(
        project_id=project_id,
        artifact_type="requirement",
        title="Requirement A",
        state="active",
        id=target_id,
        artifact_key="REQ-1",
    )

    outgoing_relationship = Relationship(
        project_id=project_id,
        source_artifact_id=current_id,
        target_artifact_id=target_id,
        relationship_type="verifies",
        id=uuid.uuid4(),
        created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        sort_order=3,
    )
    incoming_relationship = Relationship(
        project_id=project_id,
        source_artifact_id=source_id,
        target_artifact_id=current_id,
        relationship_type="blocks",
        id=uuid.uuid4(),
        created_at=datetime(2026, 1, 2, tzinfo=timezone.utc),
    )

    project_repo = AsyncMock()
    project_repo.find_by_id = AsyncMock(return_value=project)

    artifact_repo = AsyncMock()
    artifact_repo.find_by_id = AsyncMock(return_value=current_artifact)
    artifact_repo.list_by_ids_in_project = AsyncMock(return_value=[target_artifact])

    relationship_repo = AsyncMock()
    relationship_repo.list_by_artifact = AsyncMock(return_value=[outgoing_relationship, incoming_relationship])

    handler = ListRelationshipsForArtifactHandler(
        relationship_repo=relationship_repo,
        artifact_repo=artifact_repo,
        project_repo=project_repo,
    )

    result = await handler.handle(
        ListRelationshipsForArtifact(
            tenant_id=tenant_id,
            project_id=project_id,
            artifact_id=current_id,
        )
    )

    assert len(result) == 2

    outgoing_view = next(row for row in result if row.id == outgoing_relationship.id)
    assert outgoing_view.direction == "outgoing"
    assert outgoing_view.other_artifact_id == target_id
    assert outgoing_view.other_artifact_type == "requirement"
    assert outgoing_view.other_artifact_key == "REQ-1"
    assert outgoing_view.other_artifact_title == "Requirement A"
    assert outgoing_view.display_label == "Verifies"
    assert outgoing_view.sort_order == 3

    incoming_view = next(row for row in result if row.id == incoming_relationship.id)
    assert incoming_view.direction == "incoming"
    assert incoming_view.other_artifact_id == source_id
    assert incoming_view.other_artifact_type is None
    assert incoming_view.other_artifact_key is None
    assert incoming_view.other_artifact_title == str(source_id)
    assert incoming_view.display_label == "Blocked By"


@pytest.mark.asyncio
async def test_list_relationships_for_artifact_rejects_missing_artifact() -> None:
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    artifact_id = uuid.uuid4()

    project = MagicMock()
    project.tenant_id = tenant_id

    project_repo = AsyncMock()
    project_repo.find_by_id = AsyncMock(return_value=project)
    artifact_repo = AsyncMock()
    artifact_repo.find_by_id = AsyncMock(return_value=None)

    handler = ListRelationshipsForArtifactHandler(
        relationship_repo=AsyncMock(),
        artifact_repo=artifact_repo,
        project_repo=project_repo,
    )

    with pytest.raises(ValidationError, match="Artifact not found"):
        await handler.handle(
            ListRelationshipsForArtifact(
                tenant_id=tenant_id,
                project_id=project_id,
                artifact_id=artifact_id,
            )
        )


@pytest.mark.asyncio
async def test_get_artifact_impact_analysis_builds_upstream_and_downstream_trees() -> None:
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    focus_id = uuid.uuid4()
    upstream_id = uuid.uuid4()
    downstream_id = uuid.uuid4()
    deep_id = uuid.uuid4()

    project = MagicMock()
    project.tenant_id = tenant_id

    focus = Artifact.create(
        project_id=project_id,
        artifact_type="user_story",
        title="Focus",
        state="active",
        id=focus_id,
        artifact_key="US-1",
    )
    upstream = Artifact.create(
        project_id=project_id,
        artifact_type="feature",
        title="Upstream",
        state="active",
        id=upstream_id,
        artifact_key="FEAT-1",
    )
    downstream = Artifact.create(
        project_id=project_id,
        artifact_type="requirement",
        title="Downstream",
        state="new",
        id=downstream_id,
        artifact_key="REQ-1",
    )
    deep = Artifact.create(
        project_id=project_id,
        artifact_type="user_story",
        title="Deep child",
        state="new",
        id=deep_id,
        artifact_key="US-2",
        parent_id=downstream_id,
    )

    incoming = Relationship.create(
        project_id=project_id,
        source_artifact_id=upstream_id,
        target_artifact_id=focus_id,
        relationship_type="blocks",
        id=uuid.uuid4(),
    )
    outgoing = Relationship.create(
        project_id=project_id,
        source_artifact_id=focus_id,
        target_artifact_id=downstream_id,
        relationship_type="impacts",
        id=uuid.uuid4(),
    )
    deep_outgoing = Relationship.create(
        project_id=project_id,
        source_artifact_id=downstream_id,
        target_artifact_id=deep_id,
        relationship_type="impacts",
        id=uuid.uuid4(),
    )

    project_repo = AsyncMock()
    project_repo.find_by_id = AsyncMock(return_value=project)

    artifact_repo = AsyncMock()
    artifact_repo.find_by_id = AsyncMock(side_effect=lambda artifact_id: {
        focus_id: focus,
        upstream_id: upstream,
        downstream_id: downstream,
        deep_id: deep,
    }.get(artifact_id))
    artifact_repo.list_by_ids_in_project = AsyncMock(
        side_effect=lambda _project_id, artifact_ids: [
            artifact
            for artifact in (focus, upstream, downstream, deep)
            if artifact.id in artifact_ids
        ]
    )

    relationship_repo = AsyncMock()
    relationship_repo.list_relationships_to_artifacts = AsyncMock(
        side_effect=lambda _project_id, target_ids, relationship_types: (
            [incoming]
            if focus_id in target_ids and "blocks" in relationship_types
            else []
        )
    )
    relationship_repo.list_outgoing_relationships_from_artifacts = AsyncMock(
        side_effect=lambda _project_id, source_ids: (
            [outgoing]
            if focus_id in source_ids
            else [deep_outgoing]
              if downstream_id in source_ids
              else []
        )
    )

    handler = GetArtifactImpactAnalysisHandler(
        project_repo=project_repo,
        artifact_repo=artifact_repo,
        relationship_repo=relationship_repo,
    )

    result = await handler.handle(
        GetArtifactImpactAnalysis(
            tenant_id=tenant_id,
            project_id=project_id,
            artifact_id=focus_id,
            depth=2,
            relationship_types=("impacts", "blocks"),
        )
    )

    assert result.focus_artifact.id == focus_id
    assert result.applied_relationship_types == ("impacts", "blocks")
    assert len(result.trace_from) == 1
    assert result.trace_from[0].artifact_id == upstream_id
    assert result.trace_from[0].relationship_label == "Blocked By"
    assert len(result.trace_to) == 1
    assert result.trace_to[0].artifact_id == downstream_id
    assert result.trace_to[0].relationship_label == "Impacts"
    assert len(result.trace_to[0].children) == 1
    assert result.trace_to[0].children[0].artifact_id == deep_id


@pytest.mark.asyncio
async def test_get_artifact_impact_analysis_prevents_cycles_and_marks_has_more() -> None:
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    focus_id = uuid.uuid4()
    next_id = uuid.uuid4()

    project = MagicMock()
    project.tenant_id = tenant_id

    focus = Artifact.create(
        project_id=project_id,
        artifact_type="user_story",
        title="Focus",
        state="active",
        id=focus_id,
        artifact_key="US-1",
    )
    next_artifact = Artifact.create(
        project_id=project_id,
        artifact_type="feature",
        title="Next",
        state="active",
        id=next_id,
        artifact_key="FEAT-1",
        parent_id=focus_id,
    )

    focus_to_next = Relationship.create(
        project_id=project_id,
        source_artifact_id=focus_id,
        target_artifact_id=next_id,
        relationship_type="impacts",
        id=uuid.uuid4(),
    )
    next_to_focus = Relationship.create(
        project_id=project_id,
        source_artifact_id=next_id,
        target_artifact_id=focus_id,
        relationship_type="impacts",
        id=uuid.uuid4(),
    )

    project_repo = AsyncMock()
    project_repo.find_by_id = AsyncMock(return_value=project)

    artifact_repo = AsyncMock()
    artifact_repo.find_by_id = AsyncMock(side_effect=lambda artifact_id: {
        focus_id: focus,
        next_id: next_artifact,
    }.get(artifact_id))
    artifact_repo.list_by_ids_in_project = AsyncMock(
        side_effect=lambda _project_id, artifact_ids: [
            artifact for artifact in (focus, next_artifact) if artifact.id in artifact_ids
        ]
    )

    relationship_repo = AsyncMock()
    relationship_repo.list_relationships_to_artifacts = AsyncMock(return_value=[])
    relationship_repo.list_outgoing_relationships_from_artifacts = AsyncMock(
        side_effect=lambda _project_id, source_ids: (
            [focus_to_next] if focus_id in source_ids else [next_to_focus] if next_id in source_ids else []
        )
    )

    handler = GetArtifactImpactAnalysisHandler(
        project_repo=project_repo,
        artifact_repo=artifact_repo,
        relationship_repo=relationship_repo,
    )

    result = await handler.handle(
        GetArtifactImpactAnalysis(
            tenant_id=tenant_id,
            project_id=project_id,
            artifact_id=focus_id,
            direction="to",
            depth=1,
            relationship_types=("impacts",),
        )
    )

    assert len(result.trace_to) == 1
    assert result.trace_to[0].artifact_id == next_id
    assert result.trace_to[0].children == []
    assert result.trace_to[0].has_more is False

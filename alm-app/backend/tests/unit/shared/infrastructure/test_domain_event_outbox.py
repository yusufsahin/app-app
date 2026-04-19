"""Unit tests for domain event outbox serialization (no database)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import pytest

from alm.artifact.domain.events import ArtifactCreated, ArtifactStateChanged
from alm.shared.infrastructure.domain_event_outbox import (
    domain_event_to_payload,
    payload_to_domain_event,
)
from alm.tenant.domain.events import MemberInvited


def test_roundtrip_artifact_created() -> None:
    pid = uuid.uuid4()
    aid = uuid.uuid4()
    occurred = datetime(2026, 4, 18, 12, 30, tzinfo=UTC)
    original = ArtifactCreated(
        event_id=uuid.UUID("12345678-1234-5678-1234-567812345678"),
        occurred_at=occurred,
        schema_version=2,
        project_id=pid,
        artifact_id=aid,
        artifact_type="planning",
        title="Hello",
        state="draft",
    )
    packed = domain_event_to_payload(original)
    restored = payload_to_domain_event(packed)
    assert restored == original


def test_roundtrip_member_invited_list_uuids() -> None:
    rid = uuid.uuid4()
    original = MemberInvited(
        tenant_id=uuid.uuid4(),
        email="a@b.com",
        invited_by=uuid.uuid4(),
        role_ids=[rid, uuid.uuid4()],
    )
    packed = domain_event_to_payload(original)
    restored = payload_to_domain_event(packed)
    assert restored == original


def test_roundtrip_artifact_state_changed() -> None:
    original = ArtifactStateChanged(
        artifact_id=uuid.uuid4(),
        project_id=uuid.uuid4(),
        from_state="draft",
        to_state="in_progress",
    )
    packed = domain_event_to_payload(original)
    restored = payload_to_domain_event(packed)
    assert restored == original


def test_import_rejects_non_alm_types() -> None:
    packed = {
        "event_type": "os.system",
        "fields": {},
    }
    with pytest.raises(ValueError, match="disallowed"):
        payload_to_domain_event(packed)

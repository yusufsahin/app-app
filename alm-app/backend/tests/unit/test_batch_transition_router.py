"""Unit tests for batch-transition route (mediator mock; no DB)."""

from __future__ import annotations

import uuid
from unittest.mock import MagicMock

import pytest

from alm.artifact.api.schemas import BatchTransitionRequest
from alm.artifact.application.commands.transition_artifact import TransitionArtifact
from alm.orgs.api.router import batch_transition_artifacts
from alm.shared.domain.exceptions import (
    ConflictError,
    GuardDeniedError,
    PolicyDeniedError,
    ValidationError,
)
from alm.shared.infrastructure.org_resolver import ResolvedOrg
from alm.shared.infrastructure.security.dependencies import CurrentUser
from alm.tenant.application.dtos import TenantDTO


def _org(tenant_id: uuid.UUID) -> ResolvedOrg:
    return ResolvedOrg(
        tenant_id=tenant_id,
        slug="demo",
        dto=TenantDTO(id=tenant_id, name="Demo", slug="demo", tier="free"),
    )


class _MediatorOk:
    async def send(self, cmd: object) -> MagicMock:
        return MagicMock()


@pytest.mark.asyncio
async def test_batch_transition_all_ok() -> None:
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    a1, a2 = uuid.uuid4(), uuid.uuid4()
    user = CurrentUser(id=uuid.uuid4(), tenant_id=tenant_id, roles=["member"])
    mediator = _MediatorOk()

    resp = await batch_transition_artifacts(
        project_id=project_id,
        body=BatchTransitionRequest(artifact_ids=[a1, a2], new_state="active"),
        org=_org(tenant_id),
        user=user,
        _acl=None,
        mediator=mediator,
    )

    assert resp.success_count == 2
    assert resp.error_count == 0
    assert resp.results is not None
    assert resp.results[str(a1)] == "ok"
    assert resp.results[str(a2)] == "ok"


class _MediatorMixed:
    def __init__(
        self,
        id_ok: uuid.UUID,
        id_guard: uuid.UUID,
        id_policy: uuid.UUID,
        id_val: uuid.UUID,
        id_conflict: uuid.UUID,
    ) -> None:
        self._id_ok = id_ok
        self._id_guard = id_guard
        self._id_policy = id_policy
        self._id_val = id_val
        self._id_conflict = id_conflict

    async def send(self, cmd: object) -> MagicMock:
        assert isinstance(cmd, TransitionArtifact)
        aid = cmd.artifact_id
        if aid == self._id_guard:
            raise GuardDeniedError("assignee required")
        if aid == self._id_policy:
            raise PolicyDeniedError("policy")
        if aid == self._id_val:
            raise ValidationError("bad state")
        if aid == self._id_conflict:
            raise ConflictError("stale")
        assert aid == self._id_ok
        return MagicMock()


@pytest.mark.asyncio
async def test_batch_transition_mixed_outcomes() -> None:
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    id_ok = uuid.uuid4()
    id_guard = uuid.uuid4()
    id_policy = uuid.uuid4()
    id_val = uuid.uuid4()
    id_conflict = uuid.uuid4()
    user = CurrentUser(id=uuid.uuid4(), tenant_id=tenant_id, roles=["editor"])

    mediator = _MediatorMixed(id_ok, id_guard, id_policy, id_val, id_conflict)

    resp = await batch_transition_artifacts(
        project_id=project_id,
        body=BatchTransitionRequest(
            artifact_ids=[id_ok, id_guard, id_policy, id_val, id_conflict],
            new_state="done",
        ),
        org=_org(tenant_id),
        user=user,
        _acl=None,
        mediator=mediator,
    )

    assert resp.success_count == 1
    assert resp.error_count == 4
    assert resp.results is not None
    r = resp.results
    assert r[str(id_ok)] == "ok"
    assert r[str(id_guard)] == "guard_denied"
    assert r[str(id_policy)] == "policy_denied"
    assert r[str(id_val)] == "validation_error"
    assert r[str(id_conflict)] == "conflict_error"
    assert len(resp.errors) == 4


class _MediatorRuntimeError:
    async def send(self, cmd: object) -> MagicMock:
        raise RuntimeError("boom")


@pytest.mark.asyncio
async def test_batch_transition_unknown_exception_maps_to_validation_error() -> None:
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    aid = uuid.uuid4()
    user = CurrentUser(id=uuid.uuid4(), tenant_id=tenant_id, roles=[])

    mediator = _MediatorRuntimeError()

    resp = await batch_transition_artifacts(
        project_id=project_id,
        body=BatchTransitionRequest(artifact_ids=[aid], new_state="active"),
        org=_org(tenant_id),
        user=user,
        _acl=None,
        mediator=mediator,
    )

    assert resp.success_count == 0
    assert resp.error_count == 1
    assert resp.results is not None
    assert resp.results[str(aid)] == "validation_error"

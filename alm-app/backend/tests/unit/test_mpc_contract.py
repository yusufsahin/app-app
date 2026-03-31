"""Adapter contract tests: MPC mode + policy/ACL fallbacks (no DB)."""

from __future__ import annotations

import uuid
from unittest.mock import patch

import pytest

from alm.artifact.domain.mpc_resolver import acl_check, evaluate_transition_policy, get_manifest_ast
from tests.support.manifests import MPC_CONTRACT_MINIMAL_MANIFEST


@pytest.fixture
def ast():
    return get_manifest_ast(uuid.uuid4(), MPC_CONTRACT_MINIMAL_MANIFEST)


def _transition_event(*, assignee: str | None = "u1") -> dict:
    return {
        "kind": "transition",
        "name": "artifact.transition",
        "object": {
            "id": "a1",
            "type": "artifact",
            "state": "new",
            "assignee_id": assignee,
        },
        "actor": {"id": "u1", "type": "user", "roles": ["member"]},
        "context": {"from_state": "new", "to_state": "active", "project_id": "p1"},
        "timestamp": "2025-01-01T12:00:00Z",
    }


def test_strict_policy_denies_when_mpc_missing(ast):
    with (
        patch("alm.artifact.domain.mpc_resolver._HAS_MPC", False),
        patch("alm.artifact.domain.fallback_policy.settings") as s,
    ):
        s.is_production = False
        s.mpc_mode = "strict"
        allow, reasons = evaluate_transition_policy(ast, _transition_event(), actor_roles=["member"])
        assert allow is False
        assert any("MPC" in r or "strict" in r.lower() for r in reasons)


def test_degraded_policy_allows_when_mpc_missing(ast):
    with (
        patch("alm.artifact.domain.mpc_resolver._HAS_MPC", False),
        patch("alm.artifact.domain.fallback_policy.settings") as s,
    ):
        s.is_production = False
        s.mpc_mode = "degraded"
        allow, reasons = evaluate_transition_policy(ast, _transition_event(), actor_roles=["member"])
        assert allow is True
        assert reasons == []


def test_strict_acl_denies_when_mpc_missing(ast):
    with (
        patch("alm.artifact.domain.mpc_resolver._HAS_MPC", False),
        patch("alm.artifact.domain.fallback_policy.settings") as s,
    ):
        s.is_production = False
        s.mpc_mode = "strict"
        allowed, reasons = acl_check(ast, "read", "artifact", ["member"])
        assert allowed is False
        assert reasons


def test_production_forces_strict_even_if_mpc_mode_degraded(ast):
    with (
        patch("alm.artifact.domain.mpc_resolver._HAS_MPC", False),
        patch("alm.artifact.domain.fallback_policy.settings") as s,
    ):
        s.is_production = True
        s.mpc_mode = "degraded"
        allow, _ = evaluate_transition_policy(ast, _transition_event(), actor_roles=["member"])
        assert allow is False

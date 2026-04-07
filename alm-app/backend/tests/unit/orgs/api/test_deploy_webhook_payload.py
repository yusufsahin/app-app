"""Unit tests: deploy webhook JSON payload schema (_DeployWebhookPayload)."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from alm.orgs.api.routes_deploy_webhook import _DeployWebhookPayload


def test_deploy_webhook_payload_minimal_valid() -> None:
    p = _DeployWebhookPayload.model_validate(
        {"environment": "prod", "occurred_at": "2026-04-07T12:00:00Z"},
    )
    assert p.environment == "prod"
    assert p.occurred_at == "2026-04-07T12:00:00Z"
    assert p.commit_sha is None
    assert p.build_id is None


def test_deploy_webhook_payload_optional_fields() -> None:
    p = _DeployWebhookPayload.model_validate(
        {
            "environment": "staging",
            "occurred_at": "2026-01-01T00:00:00Z",
            "commit_sha": "a" * 40,
            "build_id": "gha-99",
            "artifact_keys": ["REQ-1"],
            "idempotency_key": "k1",
        },
    )
    assert p.commit_sha == "a" * 40
    assert p.build_id == "gha-99"
    assert p.artifact_keys == ["REQ-1"]
    assert p.idempotency_key == "k1"


def test_deploy_webhook_payload_rejects_empty_environment() -> None:
    with pytest.raises(ValidationError):
        _DeployWebhookPayload.model_validate({"environment": "", "occurred_at": "2026-01-01T00:00:00Z"})


def test_deploy_webhook_payload_rejects_missing_occurred_at() -> None:
    with pytest.raises(ValidationError):
        _DeployWebhookPayload.model_validate({"environment": "prod"})

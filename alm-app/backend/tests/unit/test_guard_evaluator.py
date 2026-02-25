"""Unit tests for guard evaluator (whitelist-only, no eval)."""
from __future__ import annotations

import pytest

from alm.artifact.domain.guard_evaluator import evaluate_guard


class TestEvaluateGuard:
    def test_none_guard_returns_true(self):
        assert evaluate_guard(None, {"state": "new"}) is True

    def test_assignee_required_string(self):
        assert evaluate_guard("assignee_required", {"assignee_id": "user-1"}) is True
        assert evaluate_guard("assignee_required", {"assignee_id": None}) is False
        assert evaluate_guard("assignee_required", {}) is False

    def test_assignee_required_dict(self):
        assert evaluate_guard({"type": "assignee_required"}, {"assignee_id": "u"}) is True
        assert evaluate_guard({"type": "assignee_required"}, {"assignee_id": None}) is False

    def test_field_present(self):
        assert evaluate_guard(
            {"type": "field_present", "field": "state_reason"},
            {"state_reason": "done"},
        ) is True
        assert evaluate_guard(
            {"type": "field_present", "field": "state_reason"},
            {"state_reason": ""},
        ) is False
        assert evaluate_guard(
            {"type": "field_present", "field": "state_reason"},
            {},
        ) is False

    def test_field_equals(self):
        assert evaluate_guard(
            {"type": "field_equals", "field": "state_reason", "value": "done"},
            {"state_reason": "done"},
        ) is True
        assert evaluate_guard(
            {"type": "field_equals", "field": "state_reason", "value": "done"},
            {"state_reason": "other"},
        ) is False
        assert evaluate_guard(
            {"type": "field_equals", "field": "resolution", "value": "fixed"},
            {"resolution": "fixed"},
        ) is True

    def test_custom_fields_allowed(self):
        assert evaluate_guard(
            {"type": "field_equals", "field": "custom_fields.priority", "value": "high"},
            {"custom_fields": {"priority": "high"}},
        ) is True
        assert evaluate_guard(
            {"type": "field_equals", "field": "custom_fields.priority", "value": "low"},
            {"custom_fields": {"priority": "high"}},
        ) is False

    def test_invalid_entity_snapshot_returns_false(self):
        assert evaluate_guard("assignee_required", None) is False
        assert evaluate_guard("assignee_required", "not a dict") is False

    def test_unknown_guard_type_fail_closed(self):
        assert evaluate_guard("unknown_type", {"state": "new"}) is False
        assert evaluate_guard({"type": "eval", "expr": "1+1"}, {}) is False

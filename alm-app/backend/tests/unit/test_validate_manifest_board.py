"""Tests for manifest board metadata validation."""

import pytest

from alm.project.domain.validate_manifest_board import validate_manifest_board_section
from alm.shared.domain.exceptions import ValidationError

_MIN_BUNDLE = {
    "workflows": [
        {
            "id": "w1",
            "states": [
                {"id": "new", "category": "proposed"},
                {"id": "done", "category": "completed"},
            ],
            "transitions": [],
        }
    ],
    "artifact_types": [{"id": "r", "workflow_id": "w1"}],
}


def test_board_missing_ok() -> None:
    validate_manifest_board_section({})


def test_board_invalid_type() -> None:
    with pytest.raises(ValidationError, match="board must be an object"):
        validate_manifest_board_section({"board": []})


def test_hide_unknown_state() -> None:
    b = {
        **_MIN_BUNDLE,
        "board": {"surfaces": {"default": {"hide_state_ids": ["nope"]}}},
    }
    with pytest.raises(ValidationError, match="unknown workflow state"):
        validate_manifest_board_section(b)


def test_column_order_unknown_state() -> None:
    b = {
        **_MIN_BUNDLE,
        "board": {"surfaces": {"default": {"column_order_override": ["ghost"]}}},
    }
    with pytest.raises(ValidationError, match="unknown workflow state"):
        validate_manifest_board_section(b)


def test_state_category_order_uses_categories() -> None:
    b = {
        **_MIN_BUNDLE,
        "board": {
            "surfaces": {
                "default": {
                    "column_source": "state_category",
                    "column_order_override": ["completed", "proposed"],
                }
            }
        },
    }
    validate_manifest_board_section(b)


def test_invalid_column_source() -> None:
    b = {
        **_MIN_BUNDLE,
        "board": {"surfaces": {"default": {"column_source": "nope"}}},
    }
    with pytest.raises(ValidationError, match="column_source"):
        validate_manifest_board_section(b)

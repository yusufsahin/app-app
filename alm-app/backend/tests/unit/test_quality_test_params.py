import pytest

from alm.artifact.api.quality_test_params import validate_and_normalize_test_params_json


def test_normalize_basic() -> None:
    out = validate_and_normalize_test_params_json(
        {
            "defs": [{"name": "user", "label": "U", "default": "a@x.com"}],
            "rows": [{"label": "R1", "values": {"user": "b@x.com"}}],
        }
    )
    assert out is not None
    assert out["v"] == 2
    assert out["defs"] == [{"name": "user", "type": "string", "label": "U", "default": "a@x.com"}]
    assert out["rows"][0]["label"] == "R1"
    assert out["rows"][0]["values"] == {"user": "b@x.com"}
    assert out["rows"][0]["id"]


def test_rejects_bad_defs_type() -> None:
    with pytest.raises(ValueError, match="defs must be an array"):
        validate_and_normalize_test_params_json({"defs": {}})


def test_rejects_rows_without_defs() -> None:
    with pytest.raises(ValueError, match="defs cannot be empty"):
        validate_and_normalize_test_params_json({"defs": [], "rows": [{"values": {}}]})


def test_empty_returns_none() -> None:
    assert validate_and_normalize_test_params_json({"defs": []}) is None

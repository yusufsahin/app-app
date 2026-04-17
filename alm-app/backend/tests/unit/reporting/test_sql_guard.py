"""SQL guard for QC-style report SELECT."""

import pytest

from alm.reporting.application.sql_guard import validate_report_sql, wrap_select_limit
from alm.shared.domain.exceptions import ValidationError


def test_validate_accepts_select_with_project_bind() -> None:
    sql = """
SELECT id FROM artifacts WHERE project_id = :project_id AND deleted_at IS NULL
""".strip()
    assert validate_report_sql(sql, require_project_scope=True).startswith("SELECT")


def test_validate_rejects_semicolon() -> None:
    with pytest.raises(ValidationError, match="Multiple"):
        validate_report_sql("SELECT 1; SELECT 2", require_project_scope=True)


def test_validate_rejects_without_project_bind() -> None:
    with pytest.raises(ValidationError, match=":project_id"):
        validate_report_sql("SELECT 1 AS a", require_project_scope=True)


def test_wrap_select_limit() -> None:
    w = wrap_select_limit("SELECT 1 AS x", 10)
    assert "LIMIT 10" in w
    assert "_alm_report_subq" in w

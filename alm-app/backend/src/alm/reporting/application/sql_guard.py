"""Restrict user-supplied SQL to read-only SELECT (QC-style), single statement."""

from __future__ import annotations

import re

from alm.shared.domain.exceptions import ValidationError

_FORBIDDEN = re.compile(
    r"\b("
    r"INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE|COPY|"
    r"EXECUTE|CALL|MERGE|REPLACE|COMMENT|LISTEN|NOTIFY|PREPARE|"
    r"VACUUM|CLUSTER|REINDEX|REFRESH\s+MATERIALIZED"
    r")\b",
    re.IGNORECASE | re.DOTALL,
)
_SUSPICIOUS = re.compile(
    r"(;|--|/\*|\*/|PG_SLEEP|DBLINK|LO_IMPORT|INTO\s+OUTFILE|LOAD_FILE|COPY\s*\()",
    re.IGNORECASE | re.DOTALL,
)


def validate_report_sql(sql: str, *, require_project_scope: bool) -> str:
    """Return stripped SQL or raise ValidationError."""
    s = (sql or "").strip()
    if not s:
        raise ValidationError("SQL text is required")
    if ";" in s:
        raise ValidationError("Multiple SQL statements are not allowed")
    if _SUSPICIOUS.search(s):
        raise ValidationError("SQL contains disallowed tokens (comments, semicolons, or risky functions)")
    if not s.lower().startswith("select"):
        raise ValidationError("Only SELECT queries are allowed")
    if _FORBIDDEN.search(s):
        raise ValidationError("SQL contains forbidden keywords")
    low = s.lower()
    if require_project_scope and ":project_id" not in low:
        raise ValidationError("SQL must include bind parameter :project_id for tenant-safe project scoping")
    if not require_project_scope and ":tenant_id" not in low:
        raise ValidationError("SQL must include bind parameter :tenant_id for org-scoped reports")
    return s


def wrap_select_limit(inner_sql: str, limit: int) -> str:
    lim = max(1, min(int(limit), 50_000))
    return f"SELECT * FROM (\n{inner_sql}\n) AS _alm_report_subq LIMIT {lim}"

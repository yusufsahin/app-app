"""Prompt sanitization helpers (PII redaction baseline)."""

from __future__ import annotations

import re

_EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
_TOKEN_RE = re.compile(r"\b(sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16})\b")


def redact_pii(text: str) -> str:
    sanitized = _EMAIL_RE.sub("[redacted-email]", text)
    sanitized = _TOKEN_RE.sub("[redacted-token]", sanitized)
    return sanitized

"""Unit tests: heuristic artifact key extraction from SCM context text."""

from __future__ import annotations

from alm.scm.application.artifact_key_hints import extract_artifact_key_hints


def test_extract_uppercase_tokens_in_order() -> None:
    assert extract_artifact_key_hints("Closes REQ-7 and fixes BUG-12") == ["REQ-7", "BUG-12"]


def test_extract_from_conventional_scope() -> None:
    assert extract_artifact_key_hints("feat(REQ-42): add validation") == ["REQ-42"]


def test_extract_from_branch_path_normalizes_case() -> None:
    assert extract_artifact_key_hints("Merge branch 'feature/req-9-api'") == ["REQ-9"]


def test_dedupes_preserving_first() -> None:
    assert extract_artifact_key_hints("REQ-1, REQ-1, REQ-2") == ["REQ-1", "REQ-2"]


def test_respects_limit() -> None:
    text = " ".join(f"X{i}-1" for i in range(12))
    out = extract_artifact_key_hints(text, limit=3)
    assert len(out) == 3


def test_empty_and_whitespace() -> None:
    assert extract_artifact_key_hints("") == []
    assert extract_artifact_key_hints("   \n") == []

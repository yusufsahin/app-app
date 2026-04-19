"""Sanity checks on the Alembic revision graph (no database required)."""

from __future__ import annotations

from pathlib import Path

from alembic.script import ScriptDirectory


def _migrations_dir() -> Path:
    """Resolve ``backend/migrations`` regardless of nesting under ``tests/unit``."""
    for parent in Path(__file__).resolve().parents:
        candidate = parent / "migrations"
        if candidate.is_dir() and (candidate / "versions").is_dir():
            return candidate
    raise AssertionError("Could not locate Alembic migrations directory (missing migrations/versions/).")


def test_alembic_has_single_head() -> None:
    """Multiple heads block `alembic upgrade head` until branches are merged."""
    script = ScriptDirectory(str(_migrations_dir()))
    heads = script.get_heads()
    assert len(heads) == 1, f"Expected exactly one Alembic head; got {heads}"


def test_alembic_base_revision_is_initial() -> None:
    script = ScriptDirectory(str(_migrations_dir()))
    assert script.get_base() == "001"

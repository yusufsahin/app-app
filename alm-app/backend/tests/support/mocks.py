"""Reusable AsyncMock factories for handler/unit tests."""

from __future__ import annotations

from unittest.mock import AsyncMock

from alm.artifact.domain.manifest_ast import SimpleAST


def simple_manifest_ast() -> SimpleAST:
    """AST with empty defs — use when patching ``get_manifest_ast`` in command tests."""
    return SimpleAST({})


def empty_project_tag_repo() -> AsyncMock:
    """ProjectTagRepository stub: no tags, setters no-op, validation passes."""
    tr = AsyncMock()
    tr.get_tags_by_artifact_ids = AsyncMock(return_value={})
    tr.get_tags_by_task_ids = AsyncMock(return_value={})
    tr.validate_tag_ids_for_project = AsyncMock(return_value=True)
    tr.set_artifact_tags = AsyncMock()
    tr.set_task_tags = AsyncMock()
    return tr

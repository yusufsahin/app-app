"""Artifact domain constants (e.g. system root types)."""

from __future__ import annotations

from alm.artifact.domain.manifest_workflow_metadata import DEFAULT_SYSTEM_ROOT_TYPES

# Stable tuple for SQL ``NOT IN`` and tests; values match ``DEFAULT_SYSTEM_ROOT_TYPES``.
ROOT_ARTIFACT_TYPES = tuple(sorted(DEFAULT_SYSTEM_ROOT_TYPES))


def is_root_artifact(artifact_type: str) -> bool:
    """Default triple only — prefer ``is_system_root_artifact_type(..., manifest)`` when bundle is known."""
    return artifact_type in DEFAULT_SYSTEM_ROOT_TYPES

"""Artifact domain constants (e.g. system root types)."""

ROOT_ARTIFACT_TYPES = ("root-requirement", "root-quality", "root-defect")


def is_root_artifact(artifact_type: str) -> bool:
    """Return True if artifact_type is a system project root (cannot be deleted or reparented)."""
    return artifact_type in ROOT_ARTIFACT_TYPES

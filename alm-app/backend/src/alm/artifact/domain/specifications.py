"""Artifact domain specifications — DDD Enterprise Clean Architecture."""
from __future__ import annotations

import uuid

from alm.artifact.domain.entities import Artifact
from alm.shared.domain.specification import Specification


class ArtifactInProjectSpec(Specification[Artifact]):
    """Specification: artifact belongs to given project."""

    def __init__(self, project_id: uuid.UUID) -> None:
        self._project_id = project_id

    def is_satisfied_by(self, candidate: Artifact) -> bool:
        return candidate.project_id == self._project_id


class ArtifactInStateSpec(Specification[Artifact]):
    """Specification: artifact is in given state."""

    def __init__(self, state: str) -> None:
        self._state = state

    def is_satisfied_by(self, candidate: Artifact) -> bool:
        return candidate.state == self._state


class ArtifactInStatesSpec(Specification[Artifact]):
    """Specification: artifact is in one of given states."""

    def __init__(self, states: set[str]) -> None:
        self._states = states

    def is_satisfied_by(self, candidate: Artifact) -> bool:
        return candidate.state in self._states


class ArtifactOfTypeSpec(Specification[Artifact]):
    """Specification: artifact is of given type."""

    def __init__(self, artifact_type: str) -> None:
        self._artifact_type = artifact_type

    def is_satisfied_by(self, candidate: Artifact) -> bool:
        return candidate.artifact_type == self._artifact_type

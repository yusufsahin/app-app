"""Specification pattern — DDD Enterprise Clean Architecture.

Encapsulates business rules for entity selection.
Use for repository filtering, validation, and in-memory checks.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Generic, TypeVar

T = TypeVar("T")


class Specification(ABC, Generic[T]):
    """Base specification. Subclass and implement is_satisfied_by."""

    @abstractmethod
    def is_satisfied_by(self, candidate: T) -> bool:
        """Return True if candidate satisfies this specification."""
        ...

    def and_spec(self, other: Specification[T]) -> Specification[T]:
        """Combine with another specification (AND)."""
        return AndSpecification(self, other)

    def or_spec(self, other: Specification[T]) -> Specification[T]:
        """Combine with another specification (OR)."""
        return OrSpecification(self, other)


class AndSpecification(Specification[T]):
    """Specification that requires both specs to be satisfied."""

    def __init__(self, left: Specification[T], right: Specification[T]) -> None:
        self._left = left
        self._right = right

    def is_satisfied_by(self, candidate: T) -> bool:
        return self._left.is_satisfied_by(candidate) and self._right.is_satisfied_by(candidate)


class OrSpecification(Specification[T]):
    """Specification that requires at least one spec to be satisfied."""

    def __init__(self, left: Specification[T], right: Specification[T]) -> None:
        self._left = left
        self._right = right

    def is_satisfied_by(self, candidate: T) -> bool:
        return self._left.is_satisfied_by(candidate) or self._right.is_satisfied_by(candidate)

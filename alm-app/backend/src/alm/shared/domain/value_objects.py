from __future__ import annotations

import re
import uuid
from dataclasses import dataclass


@dataclass(frozen=True)
class TenantId:
    value: uuid.UUID

    @classmethod
    def generate(cls) -> TenantId:
        return cls(value=uuid.uuid4())


@dataclass(frozen=True)
class UserId:
    value: uuid.UUID

    @classmethod
    def generate(cls) -> UserId:
        return cls(value=uuid.uuid4())


@dataclass(frozen=True)
class Email:
    value: str

    def __post_init__(self) -> None:
        if not re.match(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$", self.value):
            raise ValueError(f"Invalid email: {self.value}")


@dataclass(frozen=True)
class Slug:
    value: str

    def __post_init__(self) -> None:
        if not re.match(r"^[a-z0-9]+(?:-[a-z0-9]+)*$", self.value):
            raise ValueError(f"Invalid slug: {self.value}")

    @classmethod
    def from_string(cls, text: str) -> Slug:
        slug = re.sub(r"[^\w\s-]", "", text.lower())
        slug = re.sub(r"[-\s]+", "-", slug).strip("-")
        return cls(value=slug)

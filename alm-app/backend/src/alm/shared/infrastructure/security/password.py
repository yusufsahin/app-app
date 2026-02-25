from __future__ import annotations

import hashlib

import bcrypt


def _pre_hash(password: str) -> bytes:
    """SHA256 pre-hash to avoid bcrypt 72-byte limit."""
    return hashlib.sha256(password.encode("utf-8")).digest()


def hash_password(password: str) -> str:
    data = _pre_hash(password)
    return bcrypt.hashpw(data, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    data = _pre_hash(plain_password)
    return bcrypt.checkpw(data, hashed_password.encode("utf-8"))


class BcryptPasswordHasher:
    """IPasswordHasher implementation using bcrypt."""

    def hash(self, plain_password: str) -> str:
        return hash_password(plain_password)

    def verify(self, plain_password: str, hashed_password: str) -> bool:
        return verify_password(plain_password, hashed_password)

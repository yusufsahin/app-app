"""Fernet-based symmetric encryption for provider API keys."""

from __future__ import annotations

from cryptography.fernet import Fernet, InvalidToken

from alm.config.settings import settings


def _get_fernet() -> Fernet | None:
    key = settings.ai_encryption_key.strip()
    if not key:
        return None
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_api_key(plain_key: str) -> str:
    """Encrypt a plain-text API key. Returns plain key if encryption not configured."""
    fernet = _get_fernet()
    if fernet is None:
        return plain_key
    return fernet.encrypt(plain_key.encode()).decode()


def decrypt_api_key(encrypted_key: str) -> str:
    """Decrypt an encrypted API key. Returns key as-is if encryption not configured or token invalid."""
    fernet = _get_fernet()
    if fernet is None:
        return encrypted_key
    try:
        return fernet.decrypt(encrypted_key.encode()).decode()
    except (InvalidToken, Exception):
        # Key may be stored unencrypted (e.g., during migration or dev without ALM_AI_ENCRYPTION_KEY)
        return encrypted_key

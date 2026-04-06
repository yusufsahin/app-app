"""Project settings fields that must not appear in JSON API responses."""

from __future__ import annotations

from typing import Any

SCM_WEBHOOK_SECRET_KEYS = frozenset(
    (
        "scm_github_webhook_secret",
        "scm_gitlab_webhook_secret",
    )
)


def scm_webhook_secret_configured_flags(settings: dict[str, Any] | None) -> tuple[bool, bool]:
    if not settings:
        return False, False
    gh = settings.get("scm_github_webhook_secret")
    gl = settings.get("scm_gitlab_webhook_secret")
    gh_ok = isinstance(gh, str) and bool(gh.strip())
    gl_ok = isinstance(gl, str) and bool(gl.strip())
    return gh_ok, gl_ok


def redact_sensitive_project_settings(settings: dict[str, Any] | None) -> dict[str, Any] | None:
    if settings is None:
        return None
    return {k: v for k, v in settings.items() if k not in SCM_WEBHOOK_SECRET_KEYS}

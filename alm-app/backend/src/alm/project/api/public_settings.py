"""Project settings fields that must not appear in JSON API responses."""

from __future__ import annotations

from typing import Any

SCM_WEBHOOK_SECRET_KEYS = frozenset(
    (
        "scm_github_webhook_secret",
        "scm_gitlab_webhook_secret",
        "scm_azuredevops_webhook_secret",
    )
)

DEPLOY_WEBHOOK_SECRET_KEY = "deploy_webhook_secret"

SENSITIVE_PROJECT_SECRET_KEYS = SCM_WEBHOOK_SECRET_KEYS | frozenset((DEPLOY_WEBHOOK_SECRET_KEY,))


def scm_webhook_secret_configured_flags(settings: dict[str, Any] | None) -> tuple[bool, bool, bool]:
    if not settings:
        return False, False, False
    gh = settings.get("scm_github_webhook_secret")
    gl = settings.get("scm_gitlab_webhook_secret")
    ado = settings.get("scm_azuredevops_webhook_secret")
    gh_ok = isinstance(gh, str) and bool(gh.strip())
    gl_ok = isinstance(gl, str) and bool(gl.strip())
    ado_ok = isinstance(ado, str) and bool(ado.strip())
    return gh_ok, gl_ok, ado_ok


def deploy_webhook_secret_configured(settings: dict[str, Any] | None) -> bool:
    if not settings:
        return False
    v = settings.get(DEPLOY_WEBHOOK_SECRET_KEY)
    return isinstance(v, str) and bool(v.strip())


def redact_sensitive_project_settings(settings: dict[str, Any] | None) -> dict[str, Any] | None:
    if settings is None:
        return None
    return {k: v for k, v in settings.items() if k not in SENSITIVE_PROJECT_SECRET_KEYS}

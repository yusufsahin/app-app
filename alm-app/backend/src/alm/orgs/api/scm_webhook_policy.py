"""Optional project settings for SCM webhook delivery (enterprise policy)."""

from __future__ import annotations

import re
from typing import Any

import structlog

logger = structlog.get_logger()

SCM_WEBHOOK_GITHUB_ENABLED_KEY = "scm_webhook_github_enabled"
SCM_WEBHOOK_GITLAB_ENABLED_KEY = "scm_webhook_gitlab_enabled"
SCM_WEBHOOK_PUSH_BRANCH_REGEX_KEY = "scm_webhook_push_branch_regex"


def scm_webhook_github_processing_enabled(settings: dict[str, Any] | None) -> bool:
    """Default True; set `scm_webhook_github_enabled` to false to stop creating links (PR/push) after auth."""
    if not settings:
        return True
    v = settings.get(SCM_WEBHOOK_GITHUB_ENABLED_KEY)
    return v is not False


def scm_webhook_gitlab_processing_enabled(settings: dict[str, Any] | None) -> bool:
    if not settings:
        return True
    v = settings.get(SCM_WEBHOOK_GITLAB_ENABLED_KEY)
    return v is not False


def scm_webhook_push_branch_matches_policy(branch: str, settings: dict[str, Any] | None) -> bool:
    """If `scm_webhook_push_branch_regex` is a non-empty string, branch must match (re.search). Empty/absent = all branches."""
    if not settings or not branch:
        return True
    raw = settings.get(SCM_WEBHOOK_PUSH_BRANCH_REGEX_KEY)
    if raw is None:
        return True
    if not isinstance(raw, str):
        logger.warning("scm_webhook_push_branch_regex_wrong_type", type_name=type(raw).__name__)
        return True
    pattern = raw.strip()
    if not pattern:
        return True
    try:
        return re.search(pattern, branch) is not None
    except re.error as e:
        logger.warning("scm_webhook_push_branch_regex_invalid", error=str(e), pattern=pattern[:80])
        return True

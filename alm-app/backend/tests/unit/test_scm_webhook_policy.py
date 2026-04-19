"""Unit tests: SCM webhook enterprise policy helpers."""

from __future__ import annotations

from alm.orgs.api.scm_webhook_policy import (
    SCM_WEBHOOK_AZUREDEVOPS_ENABLED_KEY,
    SCM_WEBHOOK_GITHUB_ENABLED_KEY,
    SCM_WEBHOOK_PUSH_BRANCH_REGEX_KEY,
    scm_webhook_azuredevops_processing_enabled,
    scm_webhook_github_processing_enabled,
    scm_webhook_gitlab_processing_enabled,
    scm_webhook_push_branch_matches_policy,
)


def test_github_enabled_default_and_false() -> None:
    assert scm_webhook_github_processing_enabled({}) is True
    assert scm_webhook_github_processing_enabled(None) is True
    assert scm_webhook_github_processing_enabled({SCM_WEBHOOK_GITHUB_ENABLED_KEY: True}) is True
    assert scm_webhook_github_processing_enabled({SCM_WEBHOOK_GITHUB_ENABLED_KEY: False}) is False


def test_gitlab_enabled_default_and_false() -> None:
    assert scm_webhook_gitlab_processing_enabled({}) is True
    assert scm_webhook_gitlab_processing_enabled({"scm_webhook_gitlab_enabled": False}) is False


def test_azuredevops_enabled_default_and_false() -> None:
    assert scm_webhook_azuredevops_processing_enabled({}) is True
    assert scm_webhook_azuredevops_processing_enabled({SCM_WEBHOOK_AZUREDEVOPS_ENABLED_KEY: False}) is False


def test_push_branch_no_regex_allows_all() -> None:
    assert scm_webhook_push_branch_matches_policy("main", {}) is True
    assert scm_webhook_push_branch_matches_policy("feature/x", {SCM_WEBHOOK_PUSH_BRANCH_REGEX_KEY: ""}) is True
    assert scm_webhook_push_branch_matches_policy("feature/x", {SCM_WEBHOOK_PUSH_BRANCH_REGEX_KEY: "   "}) is True


def test_push_branch_regex_search() -> None:
    s = {SCM_WEBHOOK_PUSH_BRANCH_REGEX_KEY: r"^feature/"}
    assert scm_webhook_push_branch_matches_policy("feature/foo", s) is True
    assert scm_webhook_push_branch_matches_policy("main", s) is False


def test_push_branch_invalid_regex_denies() -> None:
    s = {SCM_WEBHOOK_PUSH_BRANCH_REGEX_KEY: "["}
    assert scm_webhook_push_branch_matches_policy("anything", s) is False

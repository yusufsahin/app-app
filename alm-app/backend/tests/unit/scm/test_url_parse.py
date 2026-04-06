"""Tests for SCM URL parsing (GitHub / GitLab)."""

from __future__ import annotations

import pytest

from alm.scm.application.url_parse import parse_scm_url


@pytest.mark.parametrize(
    ("url", "provider", "repo", "pr", "sha"),
    [
        (
            "https://github.com/acme/app/pull/42",
            "github",
            "acme/app",
            42,
            None,
        ),
        (
            "http://github.com/acme/app/pull/7/",
            "github",
            "acme/app",
            7,
            None,
        ),
        (
            "https://github.com/acme/app/commit/abcdef0123456789abcdef0123456789abcdef01",
            "github",
            "acme/app",
            None,
            "abcdef0123456789abcdef0123456789abcdef01",
        ),
        (
            "https://github.com/acme/app/commit/abcdef0",
            "github",
            "acme/app",
            None,
            "abcdef0",
        ),
        (
            "https://gitlab.com/my/group/repo/-/merge_requests/99",
            "gitlab",
            "my/group/repo",
            99,
            None,
        ),
        (
            "https://gitlab.com/org/proj/-/commit/abc1234567890abcdef1234567890abcdef1234",
            "gitlab",
            "org/proj",
            None,
            "abc1234567890abcdef1234567890abcdef1234",
        ),
    ],
)
def test_parse_scm_url_known_hosts(
    url: str,
    provider: str,
    repo: str,
    pr: int | None,
    sha: str | None,
) -> None:
    p = parse_scm_url(url)
    assert p is not None
    assert p.provider == provider
    assert p.repo_full_name == repo
    assert p.pull_request_number == pr
    assert p.commit_sha == sha


def test_parse_scm_url_unknown() -> None:
    assert parse_scm_url("https://example.com/foo") is None
    assert parse_scm_url("") is None
    assert parse_scm_url("   ") is None


def test_parse_scm_url_strips_query_and_hash() -> None:
    p = parse_scm_url("https://github.com/acme/app/pull/12?tab=files#discussion_r1")
    assert p is not None
    assert p.provider == "github"
    assert p.repo_full_name == "acme/app"
    assert p.pull_request_number == 12

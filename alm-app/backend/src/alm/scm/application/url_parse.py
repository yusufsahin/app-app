"""Parse GitHub / GitLab PR and commit URLs into provider metadata."""

from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class ParsedScmUrl:
    provider: str
    repo_full_name: str
    pull_request_number: int | None = None
    commit_sha: str | None = None


_GH_PULL = re.compile(
    r"^https?://github\.com/(?P<owner>[^/]+)/(?P<repo>[^/]+)/pull/(?P<n>\d+)/?$",
    re.IGNORECASE,
)
_GH_COMMIT = re.compile(
    r"^https?://github\.com/(?P<owner>[^/]+)/(?P<repo>[^/]+)/commit/(?P<sha>[0-9a-f]{7,40})/?$",
    re.IGNORECASE,
)
_GL_MR = re.compile(
    r"^https?://[^/]+/(?P<path>.+)/-/merge_requests/(?P<n>\d+)/?$",
    re.IGNORECASE,
)
_GL_COMMIT = re.compile(
    r"^https?://[^/]+/(?P<path>.+)/-/commit/(?P<sha>[0-9a-f]{7,40})/?$",
    re.IGNORECASE,
)


def _normalize_sha(sha: str) -> str:
    s = sha.lower()
    return s[:40] if len(s) > 40 else s


def canonical_web_url(web_url: str) -> str:
    """Normalize URL for storage and duplicate detection (strip fragment, query, trailing slash)."""
    u = (web_url or "").strip()
    if not u:
        return ""
    if "#" in u:
        u = u.split("#", 1)[0]
    if "?" in u:
        u = u.split("?", 1)[0]
    return u.rstrip("/")


def parse_scm_url(web_url: str) -> ParsedScmUrl | None:
    u = canonical_web_url(web_url)
    if not u:
        return None

    m = _GH_PULL.match(u)
    if m:
        owner, repo, n = m.group("owner"), m.group("repo"), int(m.group("n"))
        return ParsedScmUrl(
            provider="github",
            repo_full_name=f"{owner}/{repo}",
            pull_request_number=n,
        )

    m = _GH_COMMIT.match(u)
    if m:
        owner, repo, sha = m.group("owner"), m.group("repo"), m.group("sha")
        return ParsedScmUrl(
            provider="github",
            repo_full_name=f"{owner}/{repo}",
            commit_sha=_normalize_sha(sha),
        )

    m = _GL_MR.match(u)
    if m:
        path, n = m.group("path").rstrip("/"), int(m.group("n"))
        return ParsedScmUrl(
            provider="gitlab",
            repo_full_name=path,
            pull_request_number=n,
        )

    m = _GL_COMMIT.match(u)
    if m:
        path, sha = m.group("path").rstrip("/"), m.group("sha")
        return ParsedScmUrl(
            provider="gitlab",
            repo_full_name=path,
            commit_sha=_normalize_sha(sha),
        )

    return None

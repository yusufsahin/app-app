"""Preview parse result for a pasted SCM URL (S2 UX)."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.artifact.domain.entities import Artifact
from alm.artifact.domain.ports import ArtifactRepository
from alm.project.domain.ports import ProjectRepository
from alm.scm.application.artifact_key_hints import extract_artifact_key_hints
from alm.scm.application.dtos import ScmUrlPreviewDTO, ScmUrlPreviewKeyMatchDTO
from alm.scm.application.url_parse import ParsedScmUrl, canonical_web_url, parse_scm_url
from alm.scm.domain.ports import ScmLinkRepository
from alm.shared.application.query import Query, QueryHandler


def _unmatched_key_hints(
    hints: tuple[str, ...],
    matches: tuple[ScmUrlPreviewKeyMatchDTO, ...],
) -> tuple[str, ...]:
    matched_upper = {m.hint.strip().upper() for m in matches}
    return tuple(h for h in hints if h.strip() and h.strip().upper() not in matched_upper)


@dataclass(frozen=True)
class PreviewScmUrl(Query):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    artifact_id: uuid.UUID
    web_url: str
    context_text: str | None = None


class PreviewScmUrlHandler(QueryHandler[ScmUrlPreviewDTO]):
    def __init__(
        self,
        artifact_repo: ArtifactRepository,
        project_repo: ProjectRepository,
        scm_repo: ScmLinkRepository,
    ) -> None:
        self._artifact_repo = artifact_repo
        self._project_repo = project_repo
        self._scm_repo = scm_repo

    async def _detect_duplicate_link(
        self,
        artifact_id: uuid.UUID,
        canonical: str,
        parsed: ParsedScmUrl | None,
    ) -> tuple[uuid.UUID | None, str]:
        links = await self._scm_repo.list_by_artifact(artifact_id)
        for link in links:
            if canonical_web_url(link.web_url) == canonical:
                return link.id, "url"
        if parsed is None:
            return None, "none"
        r_lower = parsed.repo_full_name.lower()
        pr = parsed.pull_request_number
        sha = parsed.commit_sha.lower() if parsed.commit_sha else None
        if pr is not None:
            for link in links:
                if link.repo_full_name and link.repo_full_name.lower() == r_lower and link.pull_request_number == pr:
                    return link.id, "pull_request"
        if sha:
            for link in links:
                if not link.repo_full_name or link.repo_full_name.lower() != r_lower:
                    continue
                if link.commit_sha and link.commit_sha.lower() == sha:
                    return link.id, "commit"
        return None, "none"

    async def _resolve_key_matches(
        self,
        project_id: uuid.UUID,
        current_artifact_id: uuid.UUID,
        hints: tuple[str, ...],
    ) -> tuple[ScmUrlPreviewKeyMatchDTO, ...]:
        if not hints:
            return ()
        found = await self._artifact_repo.list_by_project_and_artifact_keys(project_id, hints)
        by_upper: dict[str, Artifact] = {}
        for art in found:
            if art.artifact_key:
                by_upper[art.artifact_key.strip().upper()] = art
        out: list[ScmUrlPreviewKeyMatchDTO] = []
        seen_upper: set[str] = set()
        for h in hints:
            u = h.strip().upper()
            if not u or u in seen_upper:
                continue
            seen_upper.add(u)
            art = by_upper.get(u)
            if art is None or not art.artifact_key:
                continue
            out.append(
                ScmUrlPreviewKeyMatchDTO(
                    hint=h,
                    artifact_id=art.id,
                    artifact_key=art.artifact_key,
                    title=art.title,
                    is_current_artifact=art.id == current_artifact_id,
                )
            )
        return tuple(out)

    async def handle(self, query: Query) -> ScmUrlPreviewDTO:
        assert isinstance(query, PreviewScmUrl)

        project = await self._project_repo.find_by_id(query.project_id)
        if project is None or project.tenant_id != query.tenant_id:
            return ScmUrlPreviewDTO(
                canonical_web_url="",
                recognized=False,
                provider=None,
                repo_full_name=None,
                pull_request_number=None,
                commit_sha=None,
                suggested_title=None,
                artifact_key_hints=(),
                artifact_key_matches=(),
                artifact_key_unmatched=(),
                duplicate_link_id=None,
                duplicate_kind="none",
            )

        artifact = await self._artifact_repo.find_by_id(query.artifact_id)
        if artifact is None or artifact.project_id != query.project_id:
            return ScmUrlPreviewDTO(
                canonical_web_url="",
                recognized=False,
                provider=None,
                repo_full_name=None,
                pull_request_number=None,
                commit_sha=None,
                suggested_title=None,
                artifact_key_hints=(),
                artifact_key_matches=(),
                artifact_key_unmatched=(),
                duplicate_link_id=None,
                duplicate_kind="none",
            )

        hints = tuple(extract_artifact_key_hints(query.context_text or ""))
        matches = await self._resolve_key_matches(query.project_id, query.artifact_id, hints)
        unmatched = _unmatched_key_hints(hints, matches)

        canonical = canonical_web_url(query.web_url)
        if not canonical:
            return ScmUrlPreviewDTO(
                canonical_web_url="",
                recognized=False,
                provider=None,
                repo_full_name=None,
                pull_request_number=None,
                commit_sha=None,
                suggested_title=None,
                artifact_key_hints=hints,
                artifact_key_matches=matches,
                artifact_key_unmatched=unmatched,
                duplicate_link_id=None,
                duplicate_kind="none",
            )

        parsed = parse_scm_url(canonical)
        dup_id, dup_kind = await self._detect_duplicate_link(query.artifact_id, canonical, parsed)

        if parsed is None:
            return ScmUrlPreviewDTO(
                canonical_web_url=canonical,
                recognized=False,
                provider=None,
                repo_full_name=None,
                pull_request_number=None,
                commit_sha=None,
                suggested_title=None,
                artifact_key_hints=hints,
                artifact_key_matches=matches,
                artifact_key_unmatched=unmatched,
                duplicate_link_id=dup_id,
                duplicate_kind=dup_kind,
            )

        title: str | None = None
        if parsed.pull_request_number is not None:
            title = f"PR #{parsed.pull_request_number}"
        elif parsed.commit_sha:
            title = f"Commit {parsed.commit_sha[:7]}"

        return ScmUrlPreviewDTO(
            canonical_web_url=canonical,
            recognized=True,
            provider=parsed.provider,
            repo_full_name=parsed.repo_full_name,
            pull_request_number=parsed.pull_request_number,
            commit_sha=parsed.commit_sha,
            suggested_title=title,
            artifact_key_hints=hints,
            artifact_key_matches=matches,
            artifact_key_unmatched=unmatched,
            duplicate_link_id=dup_id,
            duplicate_kind=dup_kind,
        )

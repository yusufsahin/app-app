"""Create SCM link on an artifact (optional task)."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from sqlalchemy.exc import IntegrityError

from alm.artifact.domain.ports import ArtifactRepository
from alm.project.domain.ports import ProjectRepository
from alm.scm.application.dtos import ScmLinkDTO
from alm.scm.application.url_parse import canonical_web_url, parse_scm_url
from alm.scm.domain.entities import ScmLink
from alm.scm.domain.ports import ScmLinkRepository
from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ValidationError
from alm.task.domain.ports import TaskRepository


@dataclass(frozen=True)
class CreateScmLink(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    artifact_id: uuid.UUID
    web_url: str
    created_by: uuid.UUID | None = None
    task_id: uuid.UUID | None = None
    provider: str | None = None
    repo_full_name: str | None = None
    ref: str | None = None
    commit_sha: str | None = None
    pull_request_number: int | None = None
    title: str | None = None
    source: str = "manual"


class CreateScmLinkHandler(CommandHandler[ScmLinkDTO]):
    def __init__(
        self,
        scm_repo: ScmLinkRepository,
        artifact_repo: ArtifactRepository,
        project_repo: ProjectRepository,
        task_repo: TaskRepository,
    ) -> None:
        self._scm_repo = scm_repo
        self._artifact_repo = artifact_repo
        self._project_repo = project_repo
        self._task_repo = task_repo

    async def handle(self, command: Command) -> ScmLinkDTO:
        assert isinstance(command, CreateScmLink)

        project = await self._project_repo.find_by_id(command.project_id)
        if project is None or project.tenant_id != command.tenant_id:
            raise ValidationError("Project not found")

        artifact = await self._artifact_repo.find_by_id(command.artifact_id)
        if artifact is None or artifact.project_id != command.project_id:
            raise ValidationError("Artifact not found")

        web_url = canonical_web_url(command.web_url)
        if not web_url:
            raise ValidationError("web_url is required")

        parsed = parse_scm_url(web_url)
        provider = (command.provider or (parsed.provider if parsed else None) or "other").strip().lower()
        if provider not in ("github", "gitlab", "other"):
            raise ValidationError("provider must be github, gitlab, or other")

        repo_full_name = (command.repo_full_name or (parsed.repo_full_name if parsed else "") or "").strip()
        if not repo_full_name:
            raise ValidationError(
                "Could not detect repository from URL; provide repo_full_name as owner/repo "
                "(or use a GitHub/GitLab PR/commit URL).",
            )

        pr_num = command.pull_request_number if command.pull_request_number is not None else None
        if pr_num is None and parsed and parsed.pull_request_number is not None:
            pr_num = parsed.pull_request_number

        sha = (command.commit_sha or "").strip() or None
        if sha is None and parsed and parsed.commit_sha:
            sha = parsed.commit_sha
        if sha:
            sha = sha.lower()[:64]

        ref = (command.ref or "").strip() or None
        title = (command.title or "").strip() or None
        if not title:
            if pr_num is not None:
                title = f"PR #{pr_num}"
            elif sha:
                title = f"Commit {sha[:7]}"

        task_id = command.task_id
        if task_id is not None:
            task = await self._task_repo.find_by_id(task_id)
            if task is None or task.project_id != command.project_id or task.artifact_id != command.artifact_id:
                raise ValidationError("Task not found for this artifact")

        source = (command.source or "manual").strip().lower()
        if source not in ("manual", "webhook", "ci"):
            raise ValidationError("source must be manual, webhook, or ci")

        link = ScmLink.create(
            project_id=command.project_id,
            artifact_id=command.artifact_id,
            task_id=task_id,
            provider=provider,
            repo_full_name=repo_full_name,
            web_url=web_url,
            ref=ref,
            commit_sha=sha,
            pull_request_number=pr_num,
            title=title,
            source=source,
            created_by=command.created_by,
        )

        try:
            await self._scm_repo.add(link)
        except IntegrityError as e:
            raise ValidationError(
                "This URL, pull request, or commit is already linked to this artifact.",
            ) from e

        return ScmLinkDTO(
            id=link.id,
            project_id=link.project_id,
            artifact_id=link.artifact_id,
            task_id=link.task_id,
            provider=link.provider,
            repo_full_name=link.repo_full_name,
            ref=link.ref,
            commit_sha=link.commit_sha,
            pull_request_number=link.pull_request_number,
            title=link.title,
            web_url=link.web_url,
            source=link.source,
            created_by=link.created_by,
            created_at=link.created_at.isoformat() if link.created_at else None,
            updated_at=link.updated_at.isoformat() if link.updated_at else None,
        )

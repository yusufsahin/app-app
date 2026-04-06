"""SCM link domain entity — artifact (and optional task) to PR/commit URL."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from alm.shared.domain.aggregate import AggregateRoot

ScmProvider = Literal["github", "gitlab", "other"]
ScmSource = Literal["manual", "webhook", "ci"]


class ScmLink(AggregateRoot):
    def __init__(
        self,
        project_id: uuid.UUID,
        artifact_id: uuid.UUID,
        provider: str,
        repo_full_name: str,
        web_url: str,
        *,
        task_id: uuid.UUID | None = None,
        ref: str | None = None,
        commit_sha: str | None = None,
        pull_request_number: int | None = None,
        title: str | None = None,
        source: str = "manual",
        id: uuid.UUID | None = None,
        created_by: uuid.UUID | None = None,
        created_at: datetime | None = None,
        updated_at: datetime | None = None,
    ) -> None:
        super().__init__(id=id)
        self.project_id = project_id
        self.artifact_id = artifact_id
        self.task_id = task_id
        self.provider = provider
        self.repo_full_name = repo_full_name
        self.ref = ref
        self.commit_sha = commit_sha
        self.pull_request_number = pull_request_number
        self.title = title
        self.web_url = web_url
        self.source = source
        self.created_by = created_by
        self.created_at = created_at
        self.updated_at = updated_at

    @classmethod
    def create(
        cls,
        project_id: uuid.UUID,
        artifact_id: uuid.UUID,
        provider: str,
        repo_full_name: str,
        web_url: str,
        *,
        task_id: uuid.UUID | None = None,
        ref: str | None = None,
        commit_sha: str | None = None,
        pull_request_number: int | None = None,
        title: str | None = None,
        source: str = "manual",
        id: uuid.UUID | None = None,
        created_by: uuid.UUID | None = None,
    ) -> ScmLink:
        return cls(
            project_id=project_id,
            artifact_id=artifact_id,
            task_id=task_id,
            provider=provider,
            repo_full_name=repo_full_name,
            ref=ref,
            commit_sha=commit_sha,
            pull_request_number=pull_request_number,
            title=title,
            web_url=web_url,
            source=source,
            id=id,
            created_by=created_by,
        )

    def to_snapshot_dict(self) -> dict[str, Any]:
        return {
            "id": str(self.id),
            "project_id": str(self.project_id),
            "artifact_id": str(self.artifact_id),
            "task_id": str(self.task_id) if self.task_id else None,
            "provider": self.provider,
            "repo_full_name": self.repo_full_name,
            "web_url": self.web_url,
        }

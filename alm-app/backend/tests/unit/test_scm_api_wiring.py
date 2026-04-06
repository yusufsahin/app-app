"""Guards against accidental reverts of SCM API wiring (e.g. ``git checkout -- src``).

If this fails, restore: org router includes, handler_registry SCM entries,
artifact repo ``list_by_project_and_artifact_keys``, ProjectResponse SCM flags,
and rate-limit webhook path bypass.
"""

from __future__ import annotations

import inspect

from alm.artifact.infrastructure.repositories import SqlAlchemyArtifactRepository
from alm.config.handler_registry import register_all_handlers
from alm.main import create_app
from alm.project.api.schemas import ProjectResponse
from alm.scm.application.commands.create_scm_link import CreateScmLink
from alm.scm.application.commands.delete_scm_link import DeleteScmLink
from alm.scm.application.queries.list_scm_links_by_artifact import ListScmLinksByArtifact
from alm.scm.application.queries.preview_scm_url import PreviewScmUrl
from alm.shared.application.mediator import (
    command_handler_is_registered,
    query_handler_is_registered,
)
from alm.shared.infrastructure.rate_limit_middleware import is_scm_provider_webhook_path


def test_scm_handlers_and_repo_wiring_present() -> None:
    register_all_handlers()

    assert command_handler_is_registered(CreateScmLink)
    assert command_handler_is_registered(DeleteScmLink)
    assert query_handler_is_registered(ListScmLinksByArtifact)
    assert query_handler_is_registered(PreviewScmUrl)

    assert hasattr(SqlAlchemyArtifactRepository, "list_by_project_and_artifact_keys")
    assert inspect.iscoroutinefunction(SqlAlchemyArtifactRepository.list_by_project_and_artifact_keys)

    assert "scm_webhook_github_secret_configured" in ProjectResponse.model_fields
    assert "scm_webhook_gitlab_secret_configured" in ProjectResponse.model_fields

    sample = "/api/v1/orgs/acme/projects/00000000-0000-0000-0000-000000000000/webhooks/github"
    assert is_scm_provider_webhook_path(sample)
    assert is_scm_provider_webhook_path(sample.replace("github", "gitlab"))


def test_scm_routes_exposed_in_openapi() -> None:
    app = create_app()
    paths = "\n".join((app.openapi().get("paths") or {}).keys())

    assert "/webhooks/github" in paths
    assert "/webhooks/gitlab" in paths
    assert "/scm-links" in paths
    assert "/unmatched-events" in paths

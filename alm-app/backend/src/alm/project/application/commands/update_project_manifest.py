"""Update project manifest: create a new process template version and point project to it."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from alm.process_template.domain.entities import ProcessTemplateVersion
from alm.process_template.domain.ports import ProcessTemplateRepository
from alm.project.domain.ports import ProjectRepository
from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ValidationError


@dataclass(frozen=True)
class UpdateProjectManifest(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    manifest_bundle: dict[str, Any]


class UpdateProjectManifestHandler(CommandHandler[dict[str, Any] | None]):
    """Create a new template version with the given manifest_bundle and set project to use it."""

    def __init__(
        self,
        project_repo: ProjectRepository,
        process_template_repo: ProcessTemplateRepository,
    ) -> None:
        self._project_repo = project_repo
        self._process_template_repo = process_template_repo

    async def handle(self, command: Command) -> dict[str, Any] | None:
        assert isinstance(command, UpdateProjectManifest)

        bundle = command.manifest_bundle or {}
        if bundle.get("defs"):
            try:
                from mpc.ast import normalize
                from mpc.validator.semantic import validate_semantic
            except ImportError:
                pass  # MPC not installed; skip semantic validation
            else:
                try:
                    ast = normalize(bundle)
                    errors = validate_semantic(ast)
                    if errors:
                        msgs = [getattr(e, "message", str(e)) for e in errors[:15]]
                        raise ValidationError("Manifest validation failed: " + "; ".join(msgs))
                except ValidationError:
                    raise
                except Exception as e:  # noqa: BLE001
                    raise ValidationError(f"Manifest invalid: {e!s}") from e

        project = await self._project_repo.find_by_id(command.project_id)
        if project is None or project.tenant_id != command.tenant_id:
            raise ValidationError("Project not found")

        if project.process_template_version_id is None:
            raise ValidationError("Project has no process template version assigned")

        current_version = await self._process_template_repo.find_version_by_id(project.process_template_version_id)
        if current_version is None:
            raise ValidationError("Process template version not found")

        # New version row so we don't mutate shared versions; unique version string per save
        version_suffix = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        new_version = ProcessTemplateVersion(
            id=uuid.uuid4(),
            template_id=current_version.template_id,
            version=f"custom-{version_suffix}",
            manifest_bundle=dict(command.manifest_bundle),
        )
        await self._process_template_repo.add_version(new_version)

        project.process_template_version_id = new_version.id
        await self._project_repo.update(project)

        return {
            "manifest_bundle": new_version.manifest_bundle,
            "version": new_version.version,
        }

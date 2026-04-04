"""Idempotent creation of system tree root artifacts for a project."""

from __future__ import annotations

from alm.artifact.domain.entities import Artifact
from alm.artifact.domain.manifest_merge_defaults import merge_manifest_metadata_defaults
from alm.artifact.domain.manifest_workflow_metadata import get_tree_root_type_map
from alm.artifact.domain.mpc_resolver import get_manifest_ast
from alm.artifact.domain.ports import ArtifactRepository
from alm.artifact.domain.workflow_sm import get_initial_state as workflow_get_initial_state
from alm.process_template.domain.ports import ProcessTemplateRepository
from alm.project.domain.entities import Project
from alm.project.application.services.effective_process_template_version import (
    effective_process_template_version,
)

_KEY_SUFFIX_MAP: dict[str, str] = {
    "root-requirement": "R0",
    "root-tests": "T0",
    "root-testsuites": "TS0",
    "root-defect": "D0",
    "root-quality": "Q0",
}


async def ensure_project_tree_roots(
    *,
    project: Project,
    artifact_repo: ArtifactRepository,
    process_template_repo: ProcessTemplateRepository,
    only_if_missing: bool = True,
) -> int:
    """Create tree root rows from the merged process template manifest.

    When ``only_if_missing`` is True, skips root types that already have at least one artifact
    in the project (normal idempotent backfill). Returns how many roots were created.
    """
    version = await effective_process_template_version(
        process_template_repo, project.process_template_version_id
    )
    if version is None:
        return 0

    manifest = merge_manifest_metadata_defaults(version.manifest_bundle or {})
    ast = get_manifest_ast(version.id, manifest)
    root_type_map = get_tree_root_type_map(manifest)
    root_types = list(dict.fromkeys(root_type_map.values()))

    created = 0
    for root_type in root_types:
        if only_if_missing:
            existing = await artifact_repo.list_by_project(
                project.id,
                type_filter=root_type,
                limit=1,
            )
            if existing:
                continue
        state = workflow_get_initial_state(manifest, root_type, ast=ast)
        if state is None and root_type.startswith("root-"):
            # Degraded template (e.g. empty bundle merged to defaults only): roots still need a row.
            state = "new"
        if state is None:
            continue
        suffix = _KEY_SUFFIX_MAP.get(root_type, f"{root_type.upper()}0")
        root = Artifact.create(
            project_id=project.id,
            artifact_type=root_type,
            title=project.name,
            state=state,
            parent_id=None,
            artifact_key=f"{project.code}-{suffix}",
        )
        await artifact_repo.add(root)
        created += 1
    return created

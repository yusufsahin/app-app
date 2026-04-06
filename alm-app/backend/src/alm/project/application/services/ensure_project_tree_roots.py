"""Idempotent creation of system tree root artifacts for a project."""

from __future__ import annotations

from typing import Any

from alm.artifact.domain.entities import Artifact
from alm.artifact.domain.manifest_merge_defaults import merge_manifest_metadata_defaults
from alm.artifact.domain.manifest_workflow_metadata import get_tree_root_type_map
from alm.artifact.domain.mpc_resolver import (
    get_artifact_type_def,
    get_manifest_ast,
    is_valid_parent_child,
)
from alm.artifact.domain.ports import ArtifactRepository
from alm.artifact.domain.workflow_sm import get_initial_state as workflow_get_initial_state
from alm.process_template.domain.ports import ProcessTemplateRepository
from alm.project.application.services.effective_process_template_version import (
    effective_process_template_version,
)
from alm.project.domain.entities import Project

_KEY_SUFFIX_MAP: dict[str, str] = {
    "root-requirement": "R0",
    "root-tests": "T0",
    "root-testsuites": "TS0",
    "root-defect": "D0",
    "root-quality": "Q0",
}

# Default first folder under quality / campaign roots when manifest declares them as direct children.
_FOLDER_SEED: dict[str, str] = {
    "quality-folder": "Catalog",
    "testsuite-folder": "Test suites",
}
_FOLDER_KEY_SUFFIX: dict[str, str] = {
    "quality-folder": "QCAT",
    "testsuite-folder": "TSF0",
}


async def _ensure_default_tree_folder_artifacts(
    *,
    project: Project,
    manifest: dict[str, Any],
    ast: Any,
    artifact_repo: ArtifactRepository,
    root_types: list[str],
) -> int:
    """Create one default catalog / campaign-collection folder under each root when manifest allows."""
    created = 0
    for root_type in root_types:
        parent_def = get_artifact_type_def(manifest, root_type, ast=ast)
        if not parent_def:
            continue
        children_raw = parent_def.get("child_types") or []
        if not isinstance(children_raw, list):
            continue
        roots = await artifact_repo.list_by_project(
            project.id,
            type_filter=root_type,
            limit=2,
            offset=0,
        )
        if len(roots) != 1:
            continue
        root_row = roots[0]
        for child_type in children_raw:
            ct = str(child_type).strip()
            if ct not in _FOLDER_SEED:
                continue
            if not is_valid_parent_child(manifest, root_type, ct, ast=ast):
                continue
            existing = await artifact_repo.list_by_project(
                project.id,
                type_filter=ct,
                parent_id=root_row.id,
                limit=1,
                offset=0,
            )
            if existing:
                continue
            state = workflow_get_initial_state(manifest, ct, ast=ast)
            if state is None:
                state = "new"
            suffix = _FOLDER_KEY_SUFFIX.get(ct, f"{ct[:6].upper()}0")
            folder = Artifact.create(
                project_id=project.id,
                artifact_type=ct,
                title=_FOLDER_SEED[ct],
                state=state,
                parent_id=root_row.id,
                artifact_key=f"{project.code}-{suffix}",
            )
            await artifact_repo.add(folder)
            created += 1
    return created


async def ensure_project_tree_roots(
    *,
    project: Project,
    artifact_repo: ArtifactRepository,
    process_template_repo: ProcessTemplateRepository,
    only_if_missing: bool = True,
) -> int:
    """Create tree root rows from the merged process template manifest.

    When ``only_if_missing`` is True, skips root types that already have at least one artifact
    in the project (normal idempotent backfill). Returns how many artifacts were created
    (tree roots plus optional default catalog/campaign folders).
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

    folder_n = await _ensure_default_tree_folder_artifacts(
        project=project,
        manifest=manifest,
        ast=ast,
        artifact_repo=artifact_repo,
        root_types=root_types,
    )
    return created + folder_n

"""List artifacts for a project."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, replace

from alm.artifact.application.dtos import ArtifactDTO
from alm.artifact.domain.fulltext_config import resolve_fulltext_regconfig
from alm.artifact.domain.manifest_merge_defaults import merge_manifest_metadata_defaults
from alm.artifact.domain.manifest_workflow_metadata import (
    resolve_system_root_artifact_types,
    resolve_tree_root_artifact_type,
)
from alm.artifact.domain.mpc_resolver import get_manifest_ast, redact_data
from alm.artifact.domain.ports import ArtifactRepository
from alm.config.settings import settings
from alm.cycle.domain.ports import CycleRepository
from alm.process_template.domain.ports import ProcessTemplateRepository
from alm.project.domain.ports import ProjectRepository
from alm.project_tag.domain.ports import ProjectTagRepository
from alm.shared.application.query import Query, QueryHandler


@dataclass(frozen=True)
class ListArtifacts(Query):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    state_filter: str | None = None
    type_filter: str | None = None
    search_query: str | None = None
    cycle_node_id: uuid.UUID | None = None
    release_cycle_node_id: uuid.UUID | None = None  # when set, filter by all iteration ids under this release
    area_node_id: uuid.UUID | None = None
    sort_by: str | None = None
    sort_order: str | None = None
    limit: int | None = None
    offset: int | None = None
    include_deleted: bool = False
    tree: str | None = None  # tree_id from manifest tree_roots (or defaults) -> filter to that root's subtree
    include_system_roots: bool = False  # when True, include system root placeholder artifacts in list + total
    actor_roles: list[str] | None = None
    parent_id: uuid.UUID | None = None  # when set, only direct children of this parent (within tree subtree if any)
    tag_id: uuid.UUID | None = None  # filter artifacts that have this project tag
    team_id: uuid.UUID | None = None  # filter artifacts assigned to this team


@dataclass
class ListArtifactsResult:
    items: list[ArtifactDTO]
    total: int


class ListArtifactsHandler(QueryHandler[ListArtifactsResult]):
    def __init__(
        self,
        artifact_repo: ArtifactRepository,
        project_repo: ProjectRepository,
        cycle_repo: CycleRepository,
        process_template_repo: ProcessTemplateRepository,
        tag_repo: ProjectTagRepository,
    ) -> None:
        self._artifact_repo = artifact_repo
        self._project_repo = project_repo
        self._cycle_repo = cycle_repo
        self._process_template_repo = process_template_repo
        self._tag_repo = tag_repo

    async def handle(self, query: Query) -> ListArtifactsResult:
        assert isinstance(query, ListArtifacts)

        project = await self._project_repo.find_by_id(query.project_id)
        if project is None or project.tenant_id != query.tenant_id:
            return ListArtifactsResult(items=[], total=0)

        version = None
        if project.process_template_version_id:
            version = await self._process_template_repo.find_version_by_id(project.process_template_version_id)
        manifest_bundle: dict | None = None
        if version:
            manifest_bundle = merge_manifest_metadata_defaults(version.manifest_bundle or {})
        system_roots = resolve_system_root_artifact_types(manifest_bundle)
        exclude_roots = not query.include_system_roots
        fts_cfg = resolve_fulltext_regconfig(manifest_bundle, settings.fulltext_search_config)

        cycle_node_ids: list[uuid.UUID] | None = None
        cycle_node_id_single: uuid.UUID | None = query.cycle_node_id
        if query.release_cycle_node_id:
            release_node = await self._cycle_repo.find_by_id(query.release_cycle_node_id)
            if release_node and release_node.project_id == query.project_id:
                all_cycles = await self._cycle_repo.list_by_project(query.project_id)
                release_path = getattr(release_node, "path", "") or ""
                # Descendants: path starts with release.path + "/" (iterations under release)
                cycle_node_ids = [
                    c.id for c in all_cycles if c.path != release_path and c.path.startswith(release_path + "/")
                ]
                if not cycle_node_ids:
                    return ListArtifactsResult(items=[], total=0)
                cycle_node_id_single = None
        elif query.cycle_node_id:
            cycle_node_id_single = query.cycle_node_id

        root_artifact_id: uuid.UUID | None = None
        if query.tree and query.tree.strip():
            root_type = resolve_tree_root_artifact_type(query.tree, manifest_bundle)
            if root_type:
                roots = await self._artifact_repo.list_by_project(
                    query.project_id,
                    type_filter=root_type,
                    limit=1,
                    include_deleted=query.include_deleted,
                    fts_regconfig=fts_cfg,
                )
                if roots:
                    root_artifact_id = roots[0].id

        total = await self._artifact_repo.count_by_project(
            query.project_id,
            query.state_filter,
            type_filter=query.type_filter,
            search_query=query.search_query,
            cycle_node_id=cycle_node_id_single,
            cycle_node_ids=cycle_node_ids,
            area_node_id=query.area_node_id,
            parent_id=query.parent_id,
            include_deleted=query.include_deleted,
            root_artifact_id=root_artifact_id,
            exclude_root_artifact_types=exclude_roots,
            root_type_ids_exclude=system_roots if exclude_roots else None,
            fts_regconfig=fts_cfg,
            tag_id=query.tag_id,
            team_id=query.team_id,
        )
        artifacts = await self._artifact_repo.list_by_project(
            query.project_id,
            query.state_filter,
            type_filter=query.type_filter,
            search_query=query.search_query,
            cycle_node_id=cycle_node_id_single,
            cycle_node_ids=cycle_node_ids,
            area_node_id=query.area_node_id,
            parent_id=query.parent_id,
            sort_by=query.sort_by,
            sort_order=query.sort_order,
            limit=query.limit,
            offset=query.offset,
            include_deleted=query.include_deleted,
            root_artifact_id=root_artifact_id,
            exclude_root_artifact_types=exclude_roots,
            root_type_ids_exclude=system_roots if exclude_roots else None,
            fts_regconfig=fts_cfg,
            tag_id=query.tag_id,
            team_id=query.team_id,
        )
        tag_map = await self._tag_repo.get_tags_by_artifact_ids([a.id for a in artifacts])
        items = [
            ArtifactDTO(
                id=a.id,
                project_id=a.project_id,
                artifact_type=a.artifact_type,
                title=a.title,
                description=a.description,
                state=a.state,
                assignee_id=a.assignee_id,
                parent_id=a.parent_id,
                custom_fields=a.custom_fields,
                artifact_key=a.artifact_key,
                state_reason=a.state_reason,
                resolution=a.resolution,
                rank_order=a.rank_order,
                cycle_node_id=getattr(a, "cycle_node_id", None),
                area_node_id=getattr(a, "area_node_id", None),
                area_path_snapshot=getattr(a, "area_path_snapshot", None),
                team_id=getattr(a, "team_id", None),
                created_at=getattr(a, "created_at", None),
                updated_at=getattr(a, "updated_at", None),
                tags=tag_map.get(a.id, ()),
            )
            for a in artifacts
        ]

        if version and manifest_bundle and items:
            ast = get_manifest_ast(version.id, manifest_bundle)
            roles = query.actor_roles or []
            redacted_items: list[ArtifactDTO] = []
            for dto in items:
                redacted_snapshot = redact_data(ast, dto.__dict__, roles)
                dto_fields = dto.__dataclass_fields__
                updates = {k: v for k, v in redacted_snapshot.items() if k in dto_fields}
                redacted_items.append(replace(dto, **updates) if updates else dto)
            items = redacted_items

        return ListArtifactsResult(items=items, total=total)

"""Org API routes: Saved queries."""

from fastapi import APIRouter

from alm.orgs.api._router_deps import *  # noqa: F403

router = APIRouter()

# ── Saved queries ──


def _saved_query_dto_to_response(dto) -> SavedQueryResponse:
    return SavedQueryResponse(
        id=dto.id,
        project_id=dto.project_id,
        name=dto.name,
        owner_id=dto.owner_id,
        visibility=dto.visibility,
        filter_params=dto.filter_params,
        created_at=dto.created_at,
        updated_at=dto.updated_at,
    )


def _parse_uuid(value) -> uuid.UUID | None:
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError):
        return None


@router.get(
    "/projects/{project_id}/saved-queries",
    response_model=list[SavedQueryResponse],
)
async def list_saved_queries(
    project_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:read"),
    mediator: Mediator = Depends(get_mediator),
) -> list[SavedQueryResponse]:
    dtos = await mediator.query(
        ListSavedQueries(
            tenant_id=org.tenant_id,
            project_id=project_id,
            user_id=user.id,
        )
    )
    return [_saved_query_dto_to_response(d) for d in dtos]


@router.post(
    "/projects/{project_id}/saved-queries",
    response_model=SavedQueryResponse,
    status_code=201,
)
async def create_saved_query(
    project_id: uuid.UUID,
    body: SavedQueryCreateRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:read"),
    mediator: Mediator = Depends(get_mediator),
) -> SavedQueryResponse:
    dto = await mediator.send(
        CreateSavedQuery(
            tenant_id=org.tenant_id,
            project_id=project_id,
            name=body.name,
            owner_id=user.id,
            filter_params=body.filter_params,
            visibility=body.visibility,
        )
    )
    return _saved_query_dto_to_response(dto)


@router.get(
    "/projects/{project_id}/saved-queries/{query_id}",
    response_model=SavedQueryResponse,
)
async def get_saved_query(
    project_id: uuid.UUID,
    query_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:read"),
    mediator: Mediator = Depends(get_mediator),
) -> SavedQueryResponse:
    dto = await mediator.query(
        GetSavedQuery(
            tenant_id=org.tenant_id,
            project_id=project_id,
            query_id=query_id,
        )
    )
    if dto is None:
        raise EntityNotFound("SavedQuery", query_id)
    return _saved_query_dto_to_response(dto)


@router.put(
    "/projects/{project_id}/saved-queries/{query_id}",
    response_model=SavedQueryResponse,
)
async def update_saved_query(
    project_id: uuid.UUID,
    query_id: uuid.UUID,
    body: SavedQueryUpdateRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:read"),
    mediator: Mediator = Depends(get_mediator),
) -> SavedQueryResponse:
    dto = await mediator.send(
        UpdateSavedQuery(
            tenant_id=org.tenant_id,
            project_id=project_id,
            query_id=query_id,
            name=body.name,
            filter_params=body.filter_params,
            visibility=body.visibility,
        )
    )
    return _saved_query_dto_to_response(dto)


@router.delete(
    "/projects/{project_id}/saved-queries/{query_id}",
    status_code=204,
)
async def delete_saved_query(
    project_id: uuid.UUID,
    query_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:read"),
    mediator: Mediator = Depends(get_mediator),
) -> None:
    await mediator.send(
        DeleteSavedQuery(
            tenant_id=org.tenant_id,
            project_id=project_id,
            query_id=query_id,
        )
    )


@router.get(
    "/projects/{project_id}/saved-queries/{query_id}/run",
    response_model=ArtifactListResponse,
)
async def run_saved_query(
    project_id: uuid.UUID,
    query_id: uuid.UUID,
    limit: int = 20,
    offset: int = 0,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:read"),
    mediator: Mediator = Depends(get_mediator),
) -> ArtifactListResponse:
    dto = await mediator.query(
        GetSavedQuery(
            tenant_id=org.tenant_id,
            project_id=project_id,
            query_id=query_id,
        )
    )
    if dto is None:
        raise EntityNotFound("SavedQuery", query_id)
    if dto.visibility == "private" and dto.owner_id != user.id:
        raise EntityNotFound("SavedQuery", query_id)
    fp = dto.filter_params or {}
    result = await mediator.query(
        ListArtifacts(
            tenant_id=org.tenant_id,
            project_id=project_id,
            state_filter=fp.get("state"),
            type_filter=fp.get("type"),
            search_query=fp.get("q"),
            cycle_id=_parse_uuid(fp.get("cycle_id")),
            release_id=_parse_uuid(fp.get("release_id")),
            area_node_id=_parse_uuid(fp.get("area_node_id")),
            sort_by=fp.get("sort_by"),
            sort_order=fp.get("sort_order"),
            limit=fp.get("limit", limit),
            offset=fp.get("offset", offset),
            include_deleted=False,
        )
    )
    items = [
        ArtifactResponse(
            id=d.id,
            project_id=d.project_id,
            artifact_type=d.artifact_type,
            title=d.title,
            description=d.description,
            state=d.state,
            assignee_id=d.assignee_id,
            parent_id=d.parent_id,
            custom_fields=d.custom_fields,
            artifact_key=d.artifact_key,
            state_reason=d.state_reason,
            resolution=d.resolution,
            rank_order=d.rank_order,
            cycle_id=getattr(d, "cycle_id", None),
            area_node_id=getattr(d, "area_node_id", None),
            area_path_snapshot=getattr(d, "area_path_snapshot", None),
            created_at=getattr(d, "created_at", None),
            updated_at=getattr(d, "updated_at", None),
        )
        for d in result.items
    ]
    return ArtifactListResponse(items=items, total=result.total)

"""P2: Manifest ACL check — ACLEngine.check(action, resource, actor_roles) before artifact/manifest read/update.
No maskField. See docs/D1_POLICY_ACL_INTEGRATION.md and REMAINING_PLAN.md P2.
"""
from __future__ import annotations

import uuid

from fastapi import Depends

from alm.shared.domain.exceptions import AccessDenied
from alm.shared.infrastructure.org_resolver import ResolvedOrg, resolve_org
from alm.shared.infrastructure.security.dependencies import (
    CurrentUser,
    get_current_user,
    get_user_privileges,
    _matches_permission,
)
from alm.config.dependencies import get_mediator
from alm.shared.application.mediator import Mediator
from alm.project.application.queries.get_project_manifest import GetProjectManifest
from alm.artifact.domain.mpc_resolver import _to_ast, acl_check


def require_manifest_acl(resource: str, action: str):
    """FastAPI dependency: run ACLEngine.check for (action, resource) with project manifest.
    Requires project_id in path. Raises AccessDenied (403) if not allowed.
    """

    async def _check(
        project_id: uuid.UUID,  # injected from path
        org: ResolvedOrg = Depends(resolve_org),
        user: CurrentUser = Depends(get_current_user),
        mediator: Mediator = Depends(get_mediator),
    ) -> None:
        manifest = await mediator.query(
            GetProjectManifest(tenant_id=org.tenant_id, project_id=project_id)
        )
        if manifest is None:
            return
        codes = await get_user_privileges(org.tenant_id, user.id)
        # Tenant-level permission bypass: skip manifest ACL when user has the right privilege
        if resource == "manifest" and action == "read" and _matches_permission(codes, "manifest:read"):
            return
        if resource == "artifact" and action == "read" and _matches_permission(codes, "artifact:read"):
            return
        if resource == "artifact" and action == "update" and _matches_permission(codes, "artifact:update"):
            return
        ast = _to_ast(manifest.manifest_bundle or {})
        allowed, reasons = acl_check(
            ast, action, resource, list(user.roles or [])
        )
        if not allowed:
            msg = "; ".join(reasons) if reasons else "ACL denied"
            raise AccessDenied(msg)

    return Depends(_check)

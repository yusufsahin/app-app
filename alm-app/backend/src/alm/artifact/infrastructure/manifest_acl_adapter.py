"""Infrastructure adapter: manifest ACL check (implements shared IManifestACLChecker)."""

from __future__ import annotations

from typing import Any

from alm.artifact.domain.mpc_resolver import _to_ast, acl_check
from alm.shared.domain.ports import IManifestACLChecker


class ManifestACLCheckerAdapter(IManifestACLChecker):
    """Delegates to artifact.domain.mpc_resolver for AST and ACL check."""

    def check(
        self,
        manifest_bundle: dict[str, Any],
        action: str,
        resource: str,
        actor_roles: list[str],
    ) -> tuple[bool, list[str]]:
        ast = _to_ast(manifest_bundle or {})
        return acl_check(ast, action, resource, actor_roles or [])

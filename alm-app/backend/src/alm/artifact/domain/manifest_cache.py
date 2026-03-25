"""Process-scoped AST cache keyed by immutable manifest version id."""

from __future__ import annotations

import uuid
from typing import Any

from alm.artifact.domain.manifest_ast import to_ast_fallback
from alm.artifact.domain.mpc_facade import HAS_MPC, mpc_normalize

_CACHE: dict[uuid.UUID, Any] = {}
_CACHE_MAX_SIZE = 128


def get_manifest_ast(version_id: uuid.UUID, manifest_bundle: dict[str, Any]) -> Any:
    """Parse manifest to AST, cached by process_template_version_id."""
    if HAS_MPC:
        if version_id in _CACHE:
            return _CACHE[version_id]
        ast = mpc_normalize(manifest_bundle)
        if len(_CACHE) >= _CACHE_MAX_SIZE:
            for k in list(_CACHE.keys())[: _CACHE_MAX_SIZE // 2]:
                del _CACHE[k]
        _CACHE[version_id] = ast
        return ast
    return to_ast_fallback(manifest_bundle)


def clear_manifest_ast_cache_for_tests() -> None:
    """Test helper."""
    _CACHE.clear()

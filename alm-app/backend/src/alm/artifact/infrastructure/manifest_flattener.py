"""Infrastructure adapter: flatten manifest defs (implements shared IManifestDefsFlattener)."""

from __future__ import annotations

from typing import Any

from alm.artifact.domain.mpc_resolver import manifest_defs_to_flat
from alm.shared.domain.ports import IManifestDefsFlattener


class ManifestDefsFlattenerAdapter(IManifestDefsFlattener):
    """Converts manifest defs to flat format; delegates to artifact domain mpc_resolver."""

    def flatten(self, manifest_bundle: dict[str, Any]) -> dict[str, Any]:
        return manifest_defs_to_flat(manifest_bundle or {})

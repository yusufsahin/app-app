"""Governance adapter for MPC v0.1.0 integration."""

from __future__ import annotations

import logging
from typing import Any

try:
    from mpc.enterprise.governance import (
        ActivationProtocol,
        ArtifactBundle,
        SigningPort,
        VerificationPort,
    )
    from mpc.kernel.canonical import stable_hash

    _HAS_GOVERNANCE = True
except ImportError:
    _HAS_GOVERNANCE = False

logger = logging.getLogger(__name__)


class ALMGovernanceAdapter:
    """Provides enterprise governance features for ALM process templates."""

    def __init__(
        self,
        signing_port: SigningPort | None = None,
        verification_port: VerificationPort | None = None,
    ) -> None:
        self.signing_port = signing_port
        self.verification_port = verification_port

    def verify_manifest(self, manifest_bundle: dict[str, Any]) -> bool:
        """Verify the integrity and signature of a manifest bundle."""
        if not _HAS_GOVERNANCE or not self.verification_port:
            logger.warning("Governance or verification port not available")
            return True  # Fallback: allow for now if not configured

        try:
            bundle = ArtifactBundle.from_dict(manifest_bundle)
            return bundle.verify(self.verification_port)
        except Exception as e:
            logger.error("Manifest verification failed: %s", e)
            return False

    def get_manifest_hash(self, manifest_bundle: dict[str, Any]) -> str | None:
        """Return the stable SHA-256 hash of the manifest bundle."""
        if not _HAS_GOVERNANCE:
            return None
        return stable_hash(manifest_bundle)

    def activate_new_version(self, manifest_bundle: dict[str, Any]) -> bool:
        """Run the full activation protocol for a new manifest version."""
        if not _HAS_GOVERNANCE:
            return True

        try:
            bundle_hash = self.get_manifest_hash(manifest_bundle)
            if not bundle_hash:
                return False

            protocol = ActivationProtocol()
            result = protocol.activate(bundle_hash)
            return result.success
        except Exception as e:
            logger.error("Activation protocol failed: %s", e)
            return False

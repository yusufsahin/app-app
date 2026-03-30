"""Shared unit-test helpers: manifest bundles, AsyncMock factories.

Usage::

    from tests.support.manifests import MPC_RESOLVER_SAMPLE_MANIFEST
    from tests.support.mocks import empty_project_tag_repo
"""

from tests.support.mocks import empty_project_tag_repo, simple_manifest_ast

__all__ = ["empty_project_tag_repo", "simple_manifest_ast"]

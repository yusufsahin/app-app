"""Unit tests: unmatched key hint helper for SCM URL preview."""

from __future__ import annotations

import uuid

from alm.scm.application.dtos import ScmUrlPreviewKeyMatchDTO
from alm.scm.application.queries.preview_scm_url import _unmatched_key_hints


def test_unmatched_excludes_matched_hints() -> None:
    m = ScmUrlPreviewKeyMatchDTO(
        hint="REQ-1",
        artifact_id=uuid.uuid4(),
        artifact_key="REQ-1",
        title="A",
        is_current_artifact=False,
    )
    assert _unmatched_key_hints(("REQ-1", "BUG-2"), (m,)) == ("BUG-2",)

#!/usr/bin/env -S uv run python
"""Run privilege + template + demo seeds (expects empty or partially empty DB). For local verify."""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))


async def main() -> None:
    # Register all mapped tables so Artifact FK resolution (e.g. cycle_nodes) works.
    import alm.admin.infrastructure.models  # noqa: F401
    import alm.area.infrastructure.models  # noqa: F401
    import alm.artifact.infrastructure.models  # noqa: F401
    import alm.relationship.infrastructure.models  # noqa: F401
    import alm.attachment.infrastructure.models  # noqa: F401
    import alm.auth.infrastructure.models  # noqa: F401
    import alm.comment.infrastructure.models  # noqa: F401
    import alm.cycle.infrastructure.models  # noqa: F401
    import alm.process_template.infrastructure.models  # noqa: F401
    import alm.project.infrastructure.models  # noqa: F401
    import alm.project.infrastructure.project_member_models  # noqa: F401
    import alm.project_tag.infrastructure.models  # noqa: F401
    import alm.saved_query.infrastructure.models  # noqa: F401
    import alm.shared.audit.models  # noqa: F401
    import alm.task.infrastructure.models  # noqa: F401
    import alm.team.infrastructure.models  # noqa: F401
    import alm.tenant.infrastructure.models  # noqa: F401
    import alm.workflow_rule.infrastructure.models  # noqa: F401
    from alm.config.seed import run_startup_seeds
    from alm.shared.infrastructure.db.session import async_session_factory

    await run_startup_seeds(async_session_factory)
    print("seed_done")


if __name__ == "__main__":
    asyncio.run(main())

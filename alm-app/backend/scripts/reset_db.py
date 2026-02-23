#!/usr/bin/env -S uv run python
"""Drop all tables, run migrations, and restart. Seed data runs on app startup.

Usage:
  cd alm-app/backend
  uv run python scripts/reset_db.py

Or with Docker (db running locally):
  uv run python scripts/reset_db.py
"""
from __future__ import annotations

import asyncio
import os
import sys

# Ensure we can import alm
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))


async def main() -> None:
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import create_async_engine
    from alm.config.settings import settings
    from alm.shared.infrastructure.db.base_model import Base

    import alm.auth.infrastructure.models  # noqa: F401
    import alm.tenant.infrastructure.models  # noqa: F401
    import alm.project.infrastructure.models  # noqa: F401
    import alm.process_template.infrastructure.models  # noqa: F401
    import alm.artifact.infrastructure.models  # noqa: F401
    import alm.shared.audit.models  # noqa: F401

    db_url = settings.database_url
    engine = create_async_engine(db_url, echo=False)

    print("Dropping public schema (CASCADE)...")
    async with engine.begin() as conn:
        await conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))

    print("Creating all tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    await engine.dispose()
    print("Done. Start the app to run seeds (privileges, process templates, demo data).")


if __name__ == "__main__":
    asyncio.run(main())

#!/usr/bin/env -S uv run python
"""Drop public schema, apply Alembic migrations to head. Seed runs on next app startup.

Usage:
  cd alm-app/backend
  uv run python scripts/reset_db.py

Set ALM_DATABASE_URL if not using default (e.g. Docker Postgres on port 5433):
  $env:ALM_DATABASE_URL="postgresql+asyncpg://alm:alm_dev_password@127.0.0.1:5433/alm"
"""
from __future__ import annotations

import asyncio
import os
import subprocess
import sys
from pathlib import Path

# Ensure we can import alm (alembic env uses settings)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))


async def main() -> None:
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import create_async_engine

    from alm.config.settings import settings

    db_url = settings.database_url
    engine = create_async_engine(db_url, echo=False)

    print("Dropping public schema (CASCADE)...")
    async with engine.begin() as conn:
        await conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))

    await engine.dispose()

    backend_root = Path(__file__).resolve().parent.parent
    print("Running Alembic migrations (upgrade head)...")
    env = os.environ.copy()
    env.setdefault("ALM_DATABASE_URL", db_url)
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=backend_root,
        env=env,
        check=False,
    )
    if result.returncode != 0:
        raise SystemExit(result.returncode)

    print("Done. Start the app to run seeds (privileges, process templates, demo data).")


if __name__ == "__main__":
    asyncio.run(main())

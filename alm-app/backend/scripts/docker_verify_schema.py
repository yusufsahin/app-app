"""Fail fast if core tables are missing after Alembic (stale Docker Postgres volume).

`alembic_version` can point at head while `public` was wiped or never migrated — seeding
then crashes with UndefinedTableError. This check surfaces that with a clear fix hint.
"""

from __future__ import annotations

import asyncio
import os
import sys

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

REQUIRED_TABLES = (
    "privileges",
    "tenants",
    "projects",
    "artifacts",
    "relationships",
)


async def _main() -> int:
    url = os.environ.get("ALM_DATABASE_URL", "").strip()
    if not url:
        print("ALM_DATABASE_URL is not set", file=sys.stderr)
        return 1

    engine = create_async_engine(url)
    try:
        async with engine.connect() as conn:
            missing_tables: list[str] = []
            for table_name in REQUIRED_TABLES:
                res = await conn.execute(text("SELECT to_regclass(:table_name)"), {"table_name": f"public.{table_name}"})
                reg = res.scalar()
                if reg is None:
                    missing_tables.append(table_name)
        if missing_tables:
            missing_rendered = ", ".join(missing_tables)
            print(
                "\nDatabase schema is missing core tables after `alembic upgrade head`.\n"
                "Usually the Postgres volume is out of sync (e.g. alembic_version advanced "
                "but tables were removed or never created on this data directory).\n"
                f"Missing tables: {missing_rendered}\n\n"
                "Fix (local dev):  docker compose down -v\n"
                "                   docker compose up --build\n",
                file=sys.stderr,
            )
            return 3
    finally:
        await engine.dispose()
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(_main()))

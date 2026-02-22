from __future__ import annotations

from pathlib import Path

import structlog
import yaml
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from alm.tenant.domain.entities import Privilege
from alm.tenant.infrastructure.repositories import SqlAlchemyPrivilegeRepository

logger = structlog.get_logger()

_SEED_DIR = Path(__file__).resolve().parents[2] / "alm_meta" / "seed"


async def seed_privileges(session_factory: async_sessionmaker[AsyncSession]) -> None:
    yaml_path = _SEED_DIR / "default_privileges.yaml"
    if not yaml_path.exists():
        logger.warning("seed_file_not_found", path=str(yaml_path))
        return

    with yaml_path.open() as f:
        data = yaml.safe_load(f)

    definitions: list[dict] = data.get("privileges", [])
    if not definitions:
        logger.info("seed_no_privileges_defined")
        return

    async with session_factory() as session:
        repo = SqlAlchemyPrivilegeRepository(session)
        to_insert: list[Privilege] = []

        for entry in definitions:
            existing = await repo.find_by_code(entry["code"])
            if existing is None:
                to_insert.append(
                    Privilege(
                        code=entry["code"],
                        resource=entry["resource"],
                        action=entry["action"],
                        description=entry.get("description", ""),
                    )
                )

        if to_insert:
            await repo.add_many(to_insert)
            await session.commit()
            logger.info("privileges_seeded", count=len(to_insert))
        else:
            logger.info("privileges_already_up_to_date")

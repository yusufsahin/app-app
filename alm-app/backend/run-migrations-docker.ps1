# Apply Alembic migrations against local Docker Postgres (alm-app/docker-compose.yml maps 5433->5432).
# Prerequisite: from repo alm-app folder run: docker compose up -d db
$ErrorActionPreference = "Stop"
$env:ALM_DATABASE_URL = "postgresql+asyncpg://alm:alm_dev_password@127.0.0.1:5433/alm"
Set-Location $PSScriptRoot
python -m alembic upgrade head
python -m alembic current

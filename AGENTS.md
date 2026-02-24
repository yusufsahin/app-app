# AGENTS.md

## Cursor Cloud specific instructions

### Architecture overview

ALM (Application Lifecycle Management) is a multi-tenant project/artifact management platform built with:
- **Backend**: Python 3.12 / FastAPI / SQLAlchemy (async) / Alembic — in `alm-app/backend/`
- **Frontend**: React 19 / TypeScript / Vite / MUI — in `alm-app/frontend/`
- **Infra**: PostgreSQL 16, Redis 7 (both run via Docker containers)

### MPC path dependency

The backend depends on `mpc` (manifest-platform-core-suite) as a path dependency at `../../manifest-platform-core-suite` relative to `alm-app/backend/`. This package must exist before `uv sync` can succeed. A minimal stub is provided at `/workspace/manifest-platform-core-suite/` — if it's missing, recreate it (see `pyproject.toml` `[tool.uv.sources]`).

### Starting infrastructure services

```bash
sudo dockerd &>/tmp/dockerd.log &
sleep 3
sudo chmod 666 /var/run/docker.sock
docker run -d --name alm-postgres -e POSTGRES_USER=alm -e POSTGRES_PASSWORD=alm_dev_password -e POSTGRES_DB=alm -p 5432:5432 postgres:16-alpine
docker run -d --name alm-redis -p 6379:6379 redis:7-alpine
```

Wait for readiness: `docker exec alm-postgres pg_isready -U alm` and `docker exec alm-redis redis-cli ping`.

### Backend

```bash
cd alm-app/backend
cp .env.example .env          # only if .env doesn't exist
uv run alembic upgrade head   # run migrations
uv run uvicorn alm.main:create_app --factory --host 0.0.0.0 --port 8000
```

The backend auto-seeds demo data on first start (admin@example.com / Admin123!). Disable with `ALM_SEED_DEMO_DATA=false`.

- **Lint**: `uv run ruff check src/` (pre-existing warnings exist in the codebase)
- **Tests**: `uv run pytest tests/unit/ -v` (unit), `uv run pytest tests/ -v` (all — requires running DB/Redis)
- **Health check**: `curl http://localhost:8000/health/liveness`

### Frontend

```bash
cd alm-app/frontend
npm ci
npx vite --host 0.0.0.0 --port 5173
```

The Vite dev server proxies `/api` and `/health` to `http://localhost:8000`.

- **Lint**: `npx eslint .` — note: no `eslint.config.js` exists yet, so this fails; this is a pre-existing repo issue.
- **Tests**: `npx vitest run` — no test files exist yet.
- **Build**: `npm run build`

### Gotchas

- The project API expects a real tenant UUID in the path (e.g. `/api/v1/tenants/{uuid}/projects/`), not `me` — extract `tid` from the JWT payload.
- Docker in this Cloud VM requires `fuse-overlayfs` storage driver and `iptables-legacy`; see the daemon.json and update-alternatives setup.
- The `package-lock.json` lockfile is used (npm), not pnpm or yarn.

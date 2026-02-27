# Full lifecycle (build, test, deploy)

Run from **alm-app** directory. Requires Node 18+, npm, uv (Python), Docker.

## Scripts (root `package.json`)

| Script | Description |
|--------|-------------|
| `npm run build` | Build frontend (Vite) + sync backend deps (uv). |
| `npm run test` | Backend pytest + frontend unit (Vitest). |
| `npm run test:e2e` | Playwright E2E (default baseURL: http://localhost:5173). |
| `npm run test:e2e:deployed` | Playwright E2E against Docker stack (http://localhost:3000). |
| `npm run deploy` | `docker compose up --build -d`. |
| `npm run lifecycle` | build → test → deploy. |
| `npm run lifecycle:full` | build → test → deploy → test:e2e:deployed. |

## One-shot full lifecycle

```bash
cd alm-app
npm install
npm run lifecycle
```

With E2E against deployed app:

```bash
npm run lifecycle:full
```

## Backend tests

- Require PostgreSQL (testcontainers or `ALM_TEST_DATABASE_URL`, or local `alm_test` DB).
- From backend: `uv run pytest tests -v`.

## Playwright (E2E)

- **Dev:** frontend on 5173, backend on 8000 → `npm run test:e2e` (from frontend) or root `npm run test:e2e`.
- **Deployed:** stack on 3000 → `PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e` or root `npm run test:e2e:deployed`.
- First run: `cd frontend && npx playwright install`.

## Test cases

- **auth.setup.ts** – Login as demo user, save storage state.
- **login-and-projects.spec.ts** – Login, org home, navigate to Artifacts.
- **artifact-flow.spec.ts** – Create artifact (New Epic/Issue), transition, delete.

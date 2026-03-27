# E2E Tests (Playwright)

Critical user flows for the ALM frontend.

## Prerequisites

- Backend running: `cd backend && uvicorn alm.main:create_app --factory --host 0.0.0.0 --port 8000`
- Frontend running: `npm run dev` (port 5173)
- Demo seed data (default): use demo user `admin@example.com` / `Admin123!`

## Run

```bash
# Install browsers (first time)
npx playwright install

# Run all E2E projects (setup runs first where needed)
npm run test:e2e

# Focused suites (each depends on setup → auth runs first)
npm run test:e2e:quality    # Quality hub + traceability
npm run test:e2e:planning   # Planning release/iteration (demo/sample-project)

# With UI (debug)
npm run test:e2e:ui

# Headed (see browser)
npm run test:e2e:headed
```

## Tests

- **auth.setup.ts** – Logs in as demo user and saves storage state for reuse.
- **login-and-projects.spec.ts** – Login, org home, navigate to Artifacts.
- **artifact-flow.spec.ts** – New Epic/Issue → create artifact → transition → delete.
- **manifest-and-demo.spec.ts** – Demo manifest page (`/demo/sample-project/manifest`), project not-found after load, unknown project shows "Back to projects".
- **quality-campaign.spec.ts** – Quality → Campaign workspace, collections, Traceability (Playwright project `quality-campaign`).
- **planning-release-iteration.spec.ts** – `demo/sample-project` planning: add release and iteration.

## Config

`playwright.config.ts` in the frontend root.

- **Dev:** Base URL `http://localhost:5173` (default). When this URL is used, Playwright can start `npm run dev` via `webServer` unless Vite is already listening (`reuseExistingServer` locally).
- **Deployed (Docker):** `PLAYWRIGHT_BASE_URL=http://localhost:9001` — set `PLAYWRIGHT_SKIP_WEBSERVER=1` if the dev server should not be spawned.
- **API:** The app calls `/api` through the Vite proxy; the backend must be running for login and flows to succeed.

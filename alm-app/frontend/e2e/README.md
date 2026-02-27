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

# Run E2E tests
npm run test:e2e

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

## Config

`playwright.config.ts` in the frontend root.

- **Dev:** Base URL `http://localhost:5173` (default).
- **Deployed (Docker):** `PLAYWRIGHT_BASE_URL=http://localhost:3000`.

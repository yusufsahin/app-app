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
```

## Tests

- **auth.setup.ts** – Logs in as demo user and saves storage state for reuse.
- **artifact-flow.spec.ts** – Create artifact → transition → delete (single flow).

## Config

`playwright.config.ts` in the frontend root. Base URL: `http://localhost:5173` (override with `PLAYWRIGHT_BASE_URL`).

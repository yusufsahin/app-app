import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests for ALM frontend.
 * Run: npx playwright test
 * Dev (Vite): PLAYWRIGHT_BASE_URL=http://localhost:5173 (default)
 * Deployed (Docker): PLAYWRIGHT_BASE_URL=http://localhost:9001 — set PLAYWRIGHT_SKIP_WEBSERVER=1 (no local Vite).
 * Local: default base URL starts `npm run dev` unless port is already in use (reuseExistingServer) or SKIP is set.
 * API: Vite must proxy `/api` to a running backend (E2E auth calls the real API).
 * @see https://playwright.dev/docs/test-configuration
 */
const DEFAULT_PLAYWRIGHT_BASE = "http://localhost:5173";
const resolvedBaseURL = process.env.PLAYWRIGHT_BASE_URL ?? DEFAULT_PLAYWRIGHT_BASE;
const shouldStartVite =
  resolvedBaseURL === DEFAULT_PLAYWRIGHT_BASE && !process.env.PLAYWRIGHT_SKIP_WEBSERVER;
// Backend startup is opt-in; most dev setups run it separately (DB/Redis required).
const shouldStartBackend =
  resolvedBaseURL === DEFAULT_PLAYWRIGHT_BASE &&
  !!process.env.PLAYWRIGHT_START_BACKEND &&
  !process.env.PLAYWRIGHT_SKIP_BACKEND;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "dot" : "html",
  ...((shouldStartVite || shouldStartBackend)
    ? {
        webServer: [
          ...(shouldStartBackend
            ? [
                {
                  command:
                    "cd ../backend && set ALM_DEBUG=true&& set ALM_JWT_SECRET_KEY=dev-e2e-secret&& uvicorn alm.main:create_app --factory --host 0.0.0.0 --port 8000",
                  url: "http://localhost:8000/health/ready",
                  reuseExistingServer: !process.env.CI,
                  timeout: 120_000,
                },
              ]
            : []),
          ...(shouldStartVite
            ? [
                {
                  command: "npm run dev",
                  url: DEFAULT_PLAYWRIGHT_BASE,
                  reuseExistingServer: !process.env.CI,
                  timeout: 120_000,
                },
              ]
            : []),
        ],
      }
    : {}),
  use: {
    baseURL: resolvedBaseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    headless: !process.env.PLAYWRIGHT_HEADED,
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "login-and-projects",
      testMatch: /login-and-projects\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
    {
      name: "artifact-flow",
      testMatch: /artifact-flow\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
    {
      name: "manifest-and-demo",
      testMatch: /manifest-and-demo\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
    {
      name: "quality-campaign",
      testMatch: /quality-(campaign|steps-editor)\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
    {
      name: "planning-release-iteration",
      testMatch: /planning-release-iteration\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],
  outputDir: "e2e/test-results",
});

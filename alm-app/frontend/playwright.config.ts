import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests for ALM frontend.
 * Run with: npx playwright test
 * Requires: backend (port 8000) and frontend (npm run dev, port 5173) running.
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5173",
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
      name: "artifact-flow",
      testMatch: /artifact-flow\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],
  outputDir: "e2e/test-results",
});

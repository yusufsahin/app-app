import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests for ALM frontend.
 * Run: npx playwright test
 * Dev (Vite): PLAYWRIGHT_BASE_URL=http://localhost:5173 (default)
 * Deployed (Docker): PLAYWRIGHT_BASE_URL=http://localhost:3000
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "dot" : "html",
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
  ],
  outputDir: "e2e/test-results",
});

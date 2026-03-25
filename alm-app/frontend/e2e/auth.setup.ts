import { test as setup } from "@playwright/test";

const DEMO_EMAIL = "admin@example.com";
const DEMO_PASSWORD = "Admin123!";
const AUTH_FILE = "e2e/.auth/user.json";

setup("authenticate and save storage state", async ({ page }) => {
  // Preflight: the frontend relies on Vite proxy (/api -> backend). Fail fast with a clear message.
  try {
    const endpoints = ["/health/ready", "/api/health/ready"];
    let lastErr: Error | null = null;
    let ok = false;
    for (const url of endpoints) {
      try {
        const health = await page.request.get(url, { timeout: 10_000 });
        if (health.ok()) {
          ok = true;
          break;
        }
        const body = await health.text().catch(() => "");
        lastErr = new Error(`Backend health at ${url} returned ${health.status()}: ${body.slice(0, 500)}`);
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error(String(e));
      }
    }
    if (!ok) throw lastErr ?? new Error("Backend health check failed");
  } catch (e) {
    throw new Error(
      `Backend is not reachable. Start the backend before running Playwright.\n` +
        `Expected /health/ready (docker) or /api/health/ready (vite proxy) to be OK.\n` +
        `Original error: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  await page.goto("/login");
  await page.getByLabel(/email/i).fill(DEMO_EMAIL);
  await page.getByRole("textbox", { name: /password/i }).fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();

  await page.waitForURL(/\/(select-tenant|[a-z-]+)/, { timeout: 15000 }).catch(() => {});

  if (page.url().includes("select-tenant")) {
    await page.getByText("Demo", { exact: false }).first().click({ timeout: 8000 });
    await page.waitForURL(/\/[a-z-]+$/, { timeout: 10000 });
  }

  await page.waitForLoadState("networkidle");
  await page.context().storageState({ path: AUTH_FILE });
});

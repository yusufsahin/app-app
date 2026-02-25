import { test as setup } from "@playwright/test";

const DEMO_EMAIL = "admin@example.com";
const DEMO_PASSWORD = "Admin123!";
const AUTH_FILE = "e2e/.auth/user.json";

setup("authenticate and save storage state", async ({ page }) => {
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

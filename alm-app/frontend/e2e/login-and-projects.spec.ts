import { test, expect } from "@playwright/test";

test.describe("Login and projects", () => {
  test("login and see org home or projects", async ({ page }) => {
    test.setTimeout(30000);
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/);
    await page.getByLabel(/email/i).fill("admin@example.com");
    await page.getByRole("textbox", { name: /password/i }).fill("Admin123!");
    await page.getByRole("button", { name: "Sign In" }).click();

    await page.waitForURL(/\/(select-tenant|[a-z-]+)/, { timeout: 15000 }).catch(() => {});

    if (page.url().includes("select-tenant")) {
      await page.getByText("Demo", { exact: false }).first().click({ timeout: 8000 });
      await page.waitForURL(/\/[a-z-]+$/, { timeout: 10000 });
    }

    await page.waitForLoadState("networkidle");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: /projects|dashboard|demo/i })).toBeVisible({ timeout: 10000 });
  });

  test("navigate to artifacts from project", async ({ page }) => {
    test.setTimeout(45000);
    await page.goto("/");
    await expect(page).not.toHaveURL(/\/login/);
    await page.waitForLoadState("networkidle");

    const orgPath = new URL(page.url()).pathname;
    const segments = orgPath.split("/").filter(Boolean);
    const orgSlug = segments[0];
    expect(orgSlug).toBeTruthy();

    const firstProjectCard = page.getByTestId("project-card").first();
    await firstProjectCard.click({ timeout: 10000 });
    await page.waitForURL(new RegExp(`/${orgSlug}/[a-z0-9-]+`), { timeout: 10000 });

    await page.getByRole("button", { name: "Artifacts" }).click();
    await page.waitForURL(/\/artifacts/, { timeout: 10000 });
    await expect(page.getByRole("heading", { name: /artifacts/i })).toBeVisible({ timeout: 10000 });
  });
});

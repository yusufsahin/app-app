import { expect, test } from "@playwright/test";

test.describe("AI smoke", () => {
  test("opens AI provider settings page when accessible", async ({ page }) => {
    await page.goto("/");
    await expect(page).not.toHaveURL(/\/login/);
    await page.waitForLoadState("networkidle");

    const path = new URL(page.url()).pathname;
    const orgSlug = path.split("/").filter(Boolean)[0];
    test.skip(!orgSlug, "Org slug is not available in this environment.");

    await page.goto(`/${orgSlug}/settings/ai`);
    await page.waitForLoadState("networkidle");

    const noAccess = page.getByText(/no access/i);
    if (await noAccess.isVisible().catch(() => false)) {
      test.skip(true, "Current user has no access to AI settings.");
    }

    await expect(page.getByRole("heading", { name: "AI Providers" })).toBeVisible({
      timeout: 15000,
    });
  });
});

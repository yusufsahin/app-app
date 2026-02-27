import { test, expect } from "@playwright/test";

const E2E_ARTIFACT_TITLE = "E2E Test Artifact " + Date.now();

test.describe("Artifact flow", () => {
  test("create, transition, and delete artifact", async ({ page }) => {
    test.setTimeout(60000);
    await page.goto("/");
    await expect(page).not.toHaveURL(/\/login/);
    await page.waitForLoadState("networkidle");

    const orgPath = new URL(page.url()).pathname;
    const segments = orgPath.split("/").filter(Boolean);
    const orgSlug = segments[0];
    expect(orgSlug).toBeTruthy();

    const firstProjectCard = page.locator('[class*="CardActionArea"]').first();
    await firstProjectCard.click({ timeout: 10000 });
    await page.waitForURL(new RegExp(`/${orgSlug}/[a-z0-9-]+`), { timeout: 10000 });

    await page.getByRole("button", { name: "Artifacts" }).click();
    await page.waitForURL(/\/artifacts/, { timeout: 10000 });
    await expect(page.getByRole("heading", { name: /artifacts/i })).toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: /New (artifact|work item|epic|issue)/i }).click();
    const menuItem = page.getByRole("menuitem", { name: /epic|issue/i }).first();
    if (await menuItem.isVisible().catch(() => false)) await menuItem.click();
    const createDialog = page.getByRole("dialog", { name: /new artifact/i });
    await createDialog.waitFor({ state: "visible", timeout: 5000 });
    await createDialog.getByRole("textbox", { name: /title|enter title/i }).fill(E2E_ARTIFACT_TITLE);
    await createDialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(E2E_ARTIFACT_TITLE)).toBeVisible({ timeout: 15000 });

    const row = page.locator("tr").filter({ hasText: E2E_ARTIFACT_TITLE });
    await row.getByRole("button", { name: "Actions" }).click();
    await page.getByRole("menuitem", { name: /move to|active|in progress/i }).first().click({ timeout: 5000 });
    await page.getByRole("button", { name: "Transition" }).click({ timeout: 5000 });
    await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 8000 });

    await row.getByRole("button", { name: "Actions" }).click();
    await page.getByRole("menuitem", { name: /delete/i }).click();
    await page.getByRole("dialog", { name: /delete artifact/i }).waitFor({ state: "visible", timeout: 3000 });
    await page.getByRole("button", { name: "Delete" }).filter({ hasText: "Delete" }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 5000 });
    await expect(page.getByText(E2E_ARTIFACT_TITLE)).not.toBeVisible({ timeout: 5000 });
  });
});

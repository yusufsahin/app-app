import { test, expect } from "@playwright/test";

const DEMO_ORG = "demo";
const DEMO_PROJECT = "sample-project";

test.describe("Manifest and demo project", () => {
  test("navigate to demo project manifest page", async ({ page }) => {
    test.setTimeout(30000);
    await page.goto("/");
    await expect(page).not.toHaveURL(/\/login/);
    await page.waitForLoadState("networkidle");

    await page.goto(`/${DEMO_ORG}/${DEMO_PROJECT}/manifest`);
    await page.waitForLoadState("networkidle");

    // Should see either manifest content or "Project not found" (never stuck on loading)
    const loading = page.getByText("Loading project…");
    const notFound = page.getByText(/Project .* not found or you don't have access/i);
    const backToProjects = page.getByRole("link", { name: /Back to projects/i });
    const manifestHeading = page.getByRole("heading", { name: /Process manifest|manifest/i });
    const initManifest = page.getByRole("button", { name: /Initialize manifest/i });
    const saveManifest = page.getByRole("button", { name: /Save manifest/i });

    await expect(loading).not.toBeVisible({ timeout: 8000 });

    const hasNotFound = await notFound.isVisible().catch(() => false);
    const hasBack = await backToProjects.isVisible().catch(() => false);
    const hasManifest = (await manifestHeading.isVisible().catch(() => false)) ||
      (await initManifest.isVisible().catch(() => false)) ||
      (await saveManifest.isVisible().catch(() => false));

    expect(hasNotFound && hasBack || hasManifest).toBe(true);
  });

  test("unknown project shows not found after load", async ({ page }) => {
    test.setTimeout(20000);
    await page.goto("/");
    await expect(page).not.toHaveURL(/\/login/);
    await page.waitForLoadState("networkidle");

    await page.goto(`/${DEMO_ORG}/nonexistent-project-12345/manifest`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Loading project…")).not.toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/Project .* not found or you don't have access/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("link", { name: /Back to projects/i })).toBeVisible();
  });
});

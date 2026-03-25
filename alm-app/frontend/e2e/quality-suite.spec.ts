import { test, expect } from "@playwright/test";

test.describe("Quality suite", () => {
  async function openProjectQuality(page: import("@playwright/test").Page) {
    await page.goto("/");
    await expect(page).not.toHaveURL(/\/login/);
    await page.waitForLoadState("networkidle");
    const orgPath = new URL(page.url()).pathname;
    const segments = orgPath.split("/").filter(Boolean);
    const orgSlug = segments[0];
    expect(orgSlug).toBeTruthy();
    await page.getByTestId("project-card").first().click({ timeout: 10000 });
    await page.waitForURL(new RegExp(`/${orgSlug}/[a-z0-9-]+`), { timeout: 10000 });
    await page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "Quality" }).click();
    await page.waitForURL(new RegExp(`/${orgSlug}/[^/]+/quality`), { timeout: 10000 });
    return orgSlug;
  }

  test("navigates to Quality hub and Traceability from project", async ({ page }) => {
    test.setTimeout(45000);
    const orgSlug = await openProjectQuality(page);
    await expect(page.getByRole("heading", { name: "Quality Test Management" })).toBeVisible({ timeout: 10000 });

    const sidebar = page.locator('[data-sidebar="sidebar"]');
    await expect(sidebar.getByRole("link", { name: "Tests" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Suites" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Runs" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Traceability" })).toBeVisible();

    await sidebar.getByRole("link", { name: "Traceability" }).click();
    await page.waitForURL(/\/quality\/traceability/, { timeout: 10000 });
    await expect(page.getByText(/quality traceability/i).first()).toBeVisible({ timeout: 10000 });

    await page.getByRole("link", { name: "Back to Quality" }).click();
    await page.waitForURL(new RegExp(`/${orgSlug}/[^/]+/quality`), { timeout: 10000 });
    await expect(page.getByRole("heading", { name: "Quality Test Management" })).toBeVisible({ timeout: 10000 });
    await sidebar.getByRole("link", { name: "Tests" }).click();
    await page.waitForURL(/\/quality\/tests/, { timeout: 10000 });
    await expect(page.getByText("Test cases", { exact: true }).first()).toBeVisible({ timeout: 10000 });
  });

  test("supports quality folder navigation and creates test-case under selected folder", async ({ page }) => {
    test.setTimeout(90000);
    await openProjectQuality(page);
    await page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "Tests" }).click();
    await page.waitForURL(/\/quality\/tests/, { timeout: 10000 });

    await expect(page.getByText("Folders", { exact: true })).toBeVisible({ timeout: 10000 });

    // Select the first concrete folder under root-quality.
    await page.locator('aside').getByRole("button").nth(1).click({ timeout: 10000 });
    await expect(page).toHaveURL(/under=[0-9a-f-]{36}/i, { timeout: 10000 });

    const tcTitle = "E2E Test Case " + Date.now();
    await page.getByPlaceholder("Create test case title").fill(tcTitle);
    await page.getByRole("button", { name: "Create test case" }).click();
    await expect(page.getByText(tcTitle).first()).toBeVisible({ timeout: 20000 });

    await page.getByRole("button", { name: /Clear folder filter/i }).click({ timeout: 10000 });
    await expect(page).not.toHaveURL(/under=/i, { timeout: 10000 });
  });

  test("executes a run via run→suite→tests links and saves progress", async ({ page }) => {
    test.setTimeout(120000);
    const orgSlug = await openProjectQuality(page);
    const sidebar = page.locator('[data-sidebar="sidebar"]');
    await sidebar.getByRole("link", { name: "Tests" }).click();
    await page.waitForURL(/\/quality\/tests/, { timeout: 10000 });

    const tcTitle = "E2E Exec Test " + Date.now();
    const suiteTitle = "E2E Exec Suite " + Date.now();
    const runTitle = "E2E Exec Run " + Date.now();

    await page.locator('aside').getByRole("button").nth(1).click({ timeout: 10000 });
    await expect(page).toHaveURL(/under=[0-9a-f-]{36}/i, { timeout: 10000 });

    await page.getByPlaceholder("Create test case title").fill(tcTitle);
    await page.getByRole("button", { name: "Create test case" }).click();
    await expect(page.getByText(tcTitle).first()).toBeVisible({ timeout: 20000 });

    await sidebar.getByRole("link", { name: "Suites" }).click();
    await page.waitForURL(/\/quality\/suites/, { timeout: 10000 });
    await page.locator('aside').getByRole("button").nth(1).click({ timeout: 10000 });
    await page.getByPlaceholder("Create suite title").fill(suiteTitle);
    await page.getByRole("button", { name: "Create suite" }).click();
    await expect(page.getByText(suiteTitle).first()).toBeVisible({ timeout: 20000 });

    await page.getByRole("button", { name: suiteTitle }).click();
    await page.locator("select").first().selectOption({ label: tcTitle });
    await page.getByRole("button", { name: "Add link" }).click();

    await sidebar.getByRole("link", { name: "Runs" }).click();
    await page.waitForURL(/\/quality\/runs/, { timeout: 10000 });
    await page.locator('aside').getByRole("button").nth(1).click({ timeout: 10000 });
    await page.getByPlaceholder("Create run title").fill(runTitle);
    await page.getByRole("button", { name: "Create run" }).click();
    await expect(page.getByText(runTitle).first()).toBeVisible({ timeout: 20000 });

    await page.getByRole("button", { name: runTitle }).click();
    await page.locator("select").first().selectOption({ label: suiteTitle });
    await page.getByRole("button", { name: "Add link" }).click();

    // Ensure the selected run is reflected in URL before executing.
    await expect(page).toHaveURL(/artifact=[0-9a-f-]{36}/i, { timeout: 10000 });
    const current = new URL(page.url());
    const runArtifactId = current.searchParams.get("artifact");
    expect(runArtifactId).toMatch(/^[0-9a-f-]{36}$/i);
    const executePath = current.pathname.replace(/\/quality\/runs$/, `/quality/runs/${runArtifactId}/execute`);

    // Navigate directly to execute route and retry once if backend is still catching up.
    await page.goto(executePath);
    await page.waitForURL(/\/quality\/runs\/[^/]+\/execute/, { timeout: 10000 });
    if (await page.getByText(/Run not found/i).isVisible().catch(() => false)) {
      await page.goto(current.pathname);
      await page.getByRole("button", { name: runTitle }).click();
      const retryId = new URL(page.url()).searchParams.get("artifact");
      expect(retryId).toMatch(/^[0-9a-f-]{36}$/i);
      const retryPath = current.pathname.replace(/\/quality\/runs$/, `/quality/runs/${retryId}/execute`);
      await page.goto(retryPath);
      await page.waitForURL(/\/quality\/runs\/[^/]+\/execute/, { timeout: 10000 });
    }
    await expect(page.getByText(/Run not found/i)).toHaveCount(0);

    const passBtn = page.getByRole("button", { name: /Pass/i }).first();
    if (await passBtn.isVisible().catch(() => false)) {
      await passBtn.click();
      await page.getByRole("button", { name: "Save" }).click();
    } else {
      await page.getByRole("button", { name: /Complete Run/i }).click();
    }
    await page.waitForURL(new RegExp(`/${orgSlug}/[^/]+/quality`), { timeout: 15000 });
  });
});

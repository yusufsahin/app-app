import { test, expect } from "@playwright/test";
import { ProjectNavigationPage } from "./pages/projectNavigation.page";
import { QualityWorkspacePage } from "./pages/qualityWorkspace.page";

test.describe("Quality suite", () => {
  test("navigates to Quality hub and Traceability from project", async ({ page }) => {
    test.setTimeout(45000);
    const nav = new ProjectNavigationPage(page);
    const orgSlug = await nav.openProjectQuality();
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
    const nav = new ProjectNavigationPage(page);
    const quality = new QualityWorkspacePage(page);
    await nav.openProjectQuality();
    await quality.openTests();

    await expect(page.getByText("Folders", { exact: true })).toBeVisible({ timeout: 10000 });

    await quality.selectFirstQualityFolder();

    const tcTitle = "E2E Test Case " + Date.now();
    await quality.createItemFromModal(tcTitle);

    await quality.clearFolderFilter();
  });

  test("renames and deletes a subfolder from tree menu", async ({ page }) => {
    test.setTimeout(90000);
    const nav = new ProjectNavigationPage(page);
    const quality = new QualityWorkspacePage(page);
    await nav.openProjectQuality();
    await quality.openTests();
    await quality.selectFirstQualityFolder();

    const parentFolderId = await quality.selectedFolderIdFromUrl();
    const base = Date.now();
    const folderTitle = `E2E Tree Folder ${base}`;
    const renamedTitle = `E2E Tree Folder Renamed ${base}`;

    await quality.createSubfolderUnder(parentFolderId, folderTitle);
    const createdFolderId = await quality.findFolderIdByTitle(folderTitle);

    await quality.renameFolderById(createdFolderId, renamedTitle);
    await quality.deleteFolderById(createdFolderId, renamedTitle);
  });

  test("executes a run via run→suite→tests links and saves progress", async ({ page }) => {
    test.setTimeout(120000);
    const nav = new ProjectNavigationPage(page);
    const quality = new QualityWorkspacePage(page);
    const orgSlug = await nav.openProjectQuality();
    await quality.openTests();

    const tcTitle = "E2E Exec Test " + Date.now();
    const suiteTitle = "E2E Exec Suite " + Date.now();
    const runTitle = "E2E Exec Run " + Date.now();

    await quality.selectFirstQualityFolder();

    await quality.createItemFromModal(tcTitle);

    await quality.openSuites();
    await quality.selectFirstQualityFolder();
    await quality.createItemFromModal(suiteTitle);

    await page.getByRole("button", { name: suiteTitle }).click();
    await page.locator("select").first().selectOption({ label: tcTitle });
    await page.getByRole("button", { name: "Add link" }).click();

    await quality.openRuns();
    await quality.selectFirstQualityFolder();
    await quality.createItemFromModal(runTitle);

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

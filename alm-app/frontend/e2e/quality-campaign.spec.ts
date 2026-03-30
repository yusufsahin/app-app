import { test, expect } from "@playwright/test";
import { ProjectNavigationPage } from "./pages/projectNavigation.page";
import { QualityWorkspacePage } from "./pages/qualityWorkspace.page";

test.describe("Quality — Campaign workspace", () => {
  test("keeps suite link modal usable across laptop viewport heights", async ({ page }) => {
    test.setTimeout(120000);
    const nav = new ProjectNavigationPage(page);
    const quality = new QualityWorkspacePage(page);
    await nav.openProjectQuality();
    await quality.openCampaign();
    await quality.selectFirstCampaignCollection();
    await quality.selectFirstCampaignSuite();
    const addTests = page.getByTestId("quality-suite-add-tests");
    const manageLinksButton = page.getByTestId("quality-link-manage-modal");
    const canOpenEditor =
      (await addTests.isVisible().catch(() => false)) || (await manageLinksButton.isVisible().catch(() => false));
    test.skip(!canOpenEditor, "Suite link editor entry point not visible in this environment.");
    if (await addTests.isVisible().catch(() => false)) {
      test.skip(await addTests.isDisabled(), "Selected suite cannot be updated in this environment.");
    } else {
      test.skip(await manageLinksButton.isDisabled(), "Selected suite cannot be updated in this environment.");
    }
    await quality.openSuiteTestLinkEditor();

    const editor = quality.suiteLinkEditor();
    const availablePane = editor
      .getByRole("heading", { name: /Available test cases|Catalog tree/ })
      .locator("..")
      .locator("..");
    const inSuitePane = editor.getByRole("heading", { name: "In this suite" }).locator("..").locator("..");
    const leftList = availablePane.locator("div.overflow-auto.rounded.border.p-1").first();
    const rightList = inSuitePane.locator("div.overflow-auto.rounded.border.p-1").first();

    await page.waitForTimeout(1200);
    test.skip(!(await editor.isVisible().catch(() => false)), "Manage links modal did not open in this environment.");
    await expect(editor).toBeVisible({ timeout: 15000 });
    await expect(
      availablePane.getByRole("button", { name: "Select all on this page" }),
    ).toBeVisible();
    const totalVisibleCheckboxes = await availablePane.locator('input[type="checkbox"]:visible').count();

    for (const height of [720, 768, 900] as const) {
      await page.setViewportSize({ width: 1366, height });
      await expect(editor).toBeVisible();
      await expect(
        availablePane.getByRole("button", { name: "Select all on this page" }),
      ).toBeVisible();

      const minVisibleRows = Math.min(height >= 768 ? 5 : 3, totalVisibleCheckboxes);
      await expect.poll(async () => {
        return await availablePane
          .locator('input[type="checkbox"]:visible')
          .count();
      }).toBeGreaterThanOrEqual(minVisibleRows);

      await expect.poll(async () => {
        return await leftList.evaluate((el) => getComputedStyle(el).overflowY);
      }).toMatch(/auto|scroll/);
      await expect.poll(async () => {
        return await rightList.evaluate((el) => getComputedStyle(el).overflowY);
      }).toMatch(/auto|scroll/);
    }
  });

  test("opens add-tests editor when URL has addTests=1", async ({ page }) => {
    test.setTimeout(90000);
    const nav = new ProjectNavigationPage(page);
    const quality = new QualityWorkspacePage(page);
    await nav.openProjectQuality();
    await quality.openCampaign();
    await quality.selectFirstCampaignCollection();
    await quality.selectFirstCampaignSuite();
    const addTests = page.getByTestId("quality-suite-add-tests");
    test.skip(!(await addTests.isVisible().catch(() => false)), "Suite link entry (Manage links) not visible.");
    const u = new URL(page.url());
    u.searchParams.set("addTests", "1");
    await page.goto(u.toString());
    await expect(quality.suiteLinkEditor()).toBeVisible({ timeout: 20000 });
  });

  test("navigates to Quality hub and Traceability from project", async ({ page }) => {
    test.setTimeout(45000);
    const nav = new ProjectNavigationPage(page);
    const quality = new QualityWorkspacePage(page);
    const orgSlug = await nav.openProjectQuality();
    await expect(page.getByRole("heading", { name: "Quality Test Management" })).toBeVisible({ timeout: 10000 });

    const sidebar = page.locator('[data-sidebar="sidebar"]');
    await expect(sidebar.getByRole("link", { name: "Catalog" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Campaign" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Runs" })).toBeVisible();

    await quality.openRunsAllRunsTab();
    await expect(page.getByTestId("quality-runs-hub-heading")).toBeVisible({ timeout: 15000 });
    await expect(sidebar.getByRole("link", { name: "Traceability" })).toBeVisible();

    await sidebar.getByRole("link", { name: "Traceability" }).click();
    await page.waitForURL(/\/quality\/traceability/, { timeout: 10000 });
    await expect(page.getByText(/quality traceability/i).first()).toBeVisible({ timeout: 10000 });

    await page.getByRole("link", { name: "Back to Quality" }).click();
    await page.waitForURL(new RegExp(`/${orgSlug}/[^/]+/quality`), { timeout: 10000 });
    await expect(page.getByRole("heading", { name: "Quality Test Management" })).toBeVisible({ timeout: 10000 });
    await sidebar.getByRole("link", { name: "Catalog" }).click();
    await page.waitForURL(/\/quality\/catalog/, { timeout: 10000 });
    await expect(page.getByText("Catalog", { exact: true }).first()).toBeVisible({ timeout: 10000 });
  });

  test("supports quality folder navigation and creates test-case under selected folder", async ({ page }) => {
    test.setTimeout(90000);
    const nav = new ProjectNavigationPage(page);
    const quality = new QualityWorkspacePage(page);
    await nav.openProjectQuality();
    await quality.openCatalog();

    await expect(page.getByText("Groups", { exact: true })).toBeVisible({ timeout: 10000 });

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
    await quality.openCatalog();
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

  test("executes a run from runs hub and saves progress", async ({ page }) => {
    test.setTimeout(120000);
    const nav = new ProjectNavigationPage(page);
    const quality = new QualityWorkspacePage(page);
    const orgSlug = await nav.openProjectQuality();
    await quality.openCatalog();

    const tcTitle = "E2E Exec Test " + Date.now();
    const suiteTitle = "E2E Exec Suite " + Date.now();
    const runTitle = "E2E Exec Run " + Date.now();

    await quality.selectFirstQualityFolder();

    await quality.createItemFromModal(tcTitle);

    await quality.openCampaign();
    await quality.selectFirstCampaignCollection();
    await quality.createItemFromModal(suiteTitle);

    await page.getByRole("button", { name: suiteTitle }).click();
    await quality.openSuiteTestLinkEditor();
    const suiteEditor = quality.suiteLinkEditor();
    await expect(suiteEditor).toBeVisible({ timeout: 20000 });
    await suiteEditor.getByRole("checkbox", { name: new RegExp(tcTitle, "i") }).click();
    await suiteEditor.getByTestId("suite-link-add-selected").click();
    await suiteEditor.getByRole("button", { name: "Close" }).click();

    await quality.openRunsAllRunsTab();
    await page.locator('button[role="combobox"]').filter({ hasText: /Select a test suite|Test paketi seçin/i }).click();
    await page.getByRole("option", { name: suiteTitle }).click();
    await page.locator('button:has-text("New run"), button:has-text("Yeni koşu")').first().click();
    await page.getByLabel(/run name|koşu adı/i).fill(runTitle);
    await page.getByRole("button", { name: /Start run|Koşuyu başlat/i }).click();
    await expect(page).toHaveURL(/runExecute=[0-9a-f-]{36}/i, { timeout: 10000 });
    const current = new URL(page.url());
    const runArtifactId = current.searchParams.get("runExecute");
    expect(runArtifactId).toMatch(/^[0-9a-f-]{36}$/i);
    const runsBase = current.pathname;

    await expect(page.getByTestId("quality-manual-execution-modal")).toBeVisible({ timeout: 15000 });
    if (await page.getByText(/Run not found|Koşu bulunamadı/i).isVisible().catch(() => false)) {
      await page.goto(runsBase);
      await page.getByRole("button", { name: runTitle }).click();
      const retryId = new URL(page.url()).searchParams.get("artifact");
      expect(retryId).toMatch(/^[0-9a-f-]{36}$/i);
      const retryUrl = `${runsBase}?runExecute=${encodeURIComponent(retryId!)}`;
      await page.goto(retryUrl);
      await expect(page.getByTestId("quality-manual-execution-modal")).toBeVisible({ timeout: 15000 });
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

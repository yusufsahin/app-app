import { test, expect } from "@playwright/test";
import { ProjectNavigationPage } from "./pages/projectNavigation.page";
import { QualityWorkspacePage } from "./pages/qualityWorkspace.page";

test.describe("Quality — manual execution modal", () => {
  test("opens runner in modal from runs list", async ({ page }) => {
    test.setTimeout(120000);
    const nav = new ProjectNavigationPage(page);
    const quality = new QualityWorkspacePage(page);
    await nav.openProjectQuality();
    await quality.openRunsAllRunsTab();

    const executeBtn = page.getByRole("button", { name: /Execute|Çalıştır/i }).first();
    test.skip(!(await executeBtn.isVisible().catch(() => false)), "No execute button on runs list in this environment.");

    await executeBtn.click();

    await expect(page.getByTestId("quality-manual-execution-modal")).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole("button", { name: /Copy link|Bağlantıyı kopyala/i })).toBeVisible();
  });
});

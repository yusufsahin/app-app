import { test, expect } from "@playwright/test";
import { ProjectNavigationPage } from "./pages/projectNavigation.page";
import { QualityWorkspacePage } from "./pages/qualityWorkspace.page";

test.describe("Quality — manual execution popout layout", () => {
  test("shows compact runner chrome when URL has popout=1", async ({ page }) => {
    test.setTimeout(120000);
    const nav = new ProjectNavigationPage(page);
    const quality = new QualityWorkspacePage(page);
    await nav.openProjectQuality();
    await quality.openRunsAllRunsTab();

    const executeBtn = page.getByRole("button", { name: /Execute|Çalıştır/i }).first();
    test.skip(!(await executeBtn.isVisible().catch(() => false)), "No execute button on runs list in this environment.");

    const popupPromise = page.waitForEvent("popup");
    await executeBtn.click();
    const popup = await popupPromise;
    await popup.waitForLoadState();

    await expect(popup.getByTestId("quality-exec-popout")).toBeVisible({ timeout: 30000 });
    await expect(popup.getByRole("button", { name: /Copy link|Bağlantıyı kopyala/i })).toBeVisible();
  });
});

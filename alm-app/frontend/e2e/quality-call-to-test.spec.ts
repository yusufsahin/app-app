import { test, expect } from "@playwright/test";
import { ProjectNavigationPage } from "./pages/projectNavigation.page";
import { QualityWorkspacePage } from "./pages/qualityWorkspace.page";

test.describe("Quality Call to Test", () => {
  test("adds a call row, selects callee via picker, saves and reopens", async ({ page }) => {
    test.setTimeout(120000);
    const nav = new ProjectNavigationPage(page);
    const quality = new QualityWorkspacePage(page);
    await nav.openProjectQuality();
    await quality.openCatalog();
    await quality.selectFirstQualityFolder();

    const base = Date.now();
    const calleeTitle = `E2E Callee ${base}`;
    const callerTitle = `E2E Caller ${base}`;
    await quality.createTestCaseWithStepActions(calleeTitle, ["Shared login step"]);
    await quality.createTestCaseWithStepActions(callerTitle, ["Before call"]);

    const callerId = await quality.findQualityArtifactIdByTitle(callerTitle, "test-case");
    await quality.openLeafEditFromTree(callerId);

    const modal = page.getByTestId("quality-artifact-modal");
    await expect(modal).toBeVisible();
    await modal.getByTestId("step-add-call-button").click();
    await modal.getByTestId(/^quality-call-pick-/).first().click();

    const pickerDialog = page.getByRole("dialog").filter({ has: page.getByPlaceholder(/Search test cases/i) });
    await expect(pickerDialog.getByPlaceholder(/Search test cases/i)).toBeVisible({ timeout: 15000 });
    await pickerDialog.getByPlaceholder(/Search test cases/i).fill(calleeTitle);
    await pickerDialog.getByText(calleeTitle, { exact: true }).click();

    await expect(modal.getByText(calleeTitle).first()).toBeVisible({ timeout: 10000 });
    await page.getByTestId("artifact-modal-save").click();
    await expect(page.getByTestId("artifact-modal-title-input")).toBeHidden({ timeout: 15000 });

    await quality.openLeafEditFromTree(callerId);
    const modal2 = page.getByTestId("quality-artifact-modal");
    await expect(modal2).toBeVisible();
    await expect(modal2.getByText(calleeTitle).first()).toBeVisible();
  });
});

import { test, expect } from "@playwright/test";
import { ProjectNavigationPage } from "./pages/projectNavigation.page";
import { QualityWorkspacePage } from "./pages/qualityWorkspace.page";

test.describe("Quality test-case steps editor", () => {
  test("creates multiple steps, reopens edit to verify, deletes one step, reorders with arrow, persists", async ({
    page,
  }) => {
    test.setTimeout(120000);
    const nav = new ProjectNavigationPage(page);
    const quality = new QualityWorkspacePage(page);
    await nav.openProjectQuality();
    await quality.openCatalog();
    await quality.selectFirstQualityFolder();

    const base = Date.now();
    const tcTitle = `E2E Steps ${base}`;
    await quality.createTestCaseWithStepActions(tcTitle, ["First action", "Second action"]);

    const artifactId = await quality.findQualityArtifactIdByTitle(tcTitle, "test-case");
    await quality.openLeafEditFromTree(artifactId);

    const modal = page.getByTestId("quality-artifact-modal");
    await expect(modal).toBeVisible();
    await expect(modal.getByLabel(/action/i).nth(0)).toHaveValue("First action");
    await expect(modal.getByLabel(/action/i).nth(1)).toHaveValue("Second action");

    const secondCard = modal.locator('[data-testid^="quality-step-card-"]').nth(1);
    const secondStepId = await secondCard.getAttribute("data-step-id");
    expect(secondStepId).toBeTruthy();
    await modal.getByTestId(`quality-step-delete-${secondStepId!}`).click();

    await expect(modal.getByLabel(/action/i)).toHaveCount(1);
    await expect(modal.getByLabel(/action/i).first()).toHaveValue("First action");

    await page.getByTestId("artifact-modal-save").click();
    await expect(page.getByTestId("artifact-modal-title-input")).toBeHidden({ timeout: 15000 });

    await quality.openLeafEditFromTree(artifactId);
    const modal2 = page.getByTestId("quality-artifact-modal");
    await expect(modal2.getByLabel(/action/i)).toHaveCount(1);

    await quality.createTestCaseWithStepActions(`E2E Reorder ${base}`, ["Alpha", "Beta"]);
    const reorderId = await quality.findQualityArtifactIdByTitle(`E2E Reorder ${base}`, "test-case");
    await quality.openLeafEditFromTree(reorderId);
    const modal3 = page.getByTestId("quality-artifact-modal");
    const firstCard = modal3.locator('[data-testid^="quality-step-card-"]').first();
    const firstStepId = await firstCard.getAttribute("data-step-id");
    expect(firstStepId).toBeTruthy();
    await modal3.getByTestId(`quality-step-move-down-${firstStepId!}`).click();
    await expect(modal3.getByLabel(/action/i).nth(0)).toHaveValue("Beta");
    await expect(modal3.getByLabel(/action/i).nth(1)).toHaveValue("Alpha");
    await page.getByTestId("artifact-modal-save").click();
    await expect(page.getByTestId("artifact-modal-title-input")).toBeHidden({ timeout: 15000 });

    await quality.openLeafEditFromTree(reorderId);
    const modal4 = page.getByTestId("quality-artifact-modal");
    await expect(modal4.getByLabel(/action/i).nth(0)).toHaveValue("Beta");
    await expect(modal4.getByLabel(/action/i).nth(1)).toHaveValue("Alpha");
    await page.getByTestId("artifact-modal-cancel").click();
  });
});

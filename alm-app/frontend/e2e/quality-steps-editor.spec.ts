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
    await quality.openTests();
    await quality.selectFirstQualityFolder();

    const base = Date.now();
    const tcTitle = `E2E Steps ${base}`;
    await quality.createTestCaseWithStepActions(tcTitle, ["First action", "Second action"]);

    const artifactId = await quality.findQualityArtifactIdByTitle(tcTitle, "test-case");
    await quality.openLeafEditFromTree(artifactId);

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel(/action/i).nth(0)).toHaveValue("First action");
    await expect(dialog.getByLabel(/action/i).nth(1)).toHaveValue("Second action");

    const secondCard = dialog.locator("[data-testid^=\"quality-step-card-\"]").nth(1);
    await secondCard.hover();
    const secondStepId = await secondCard.getAttribute("data-step-id");
    expect(secondStepId).toBeTruthy();
    await dialog.getByTestId(`quality-step-delete-${secondStepId}`).click();

    await expect(dialog.getByLabel(/action/i)).toHaveCount(1);
    await expect(dialog.getByLabel(/action/i).first()).toHaveValue("First action");

    await page.getByTestId("artifact-modal-save").click();
    await expect(dialog).toBeHidden({ timeout: 15000 });

    await quality.openLeafEditFromTree(artifactId);
    const dialog2 = page.getByRole("dialog");
    await expect(dialog2.getByLabel(/action/i)).toHaveCount(1);

    await quality.createTestCaseWithStepActions(`E2E Reorder ${base}`, ["Alpha", "Beta"]);
    const reorderId = await quality.findQualityArtifactIdByTitle(`E2E Reorder ${base}`, "test-case");
    await quality.openLeafEditFromTree(reorderId);
    const dialog3 = page.getByRole("dialog");
    const firstCard = dialog3.locator("[data-testid^=\"quality-step-card-\"]").first();
    await firstCard.hover();
    const firstStepId = await firstCard.getAttribute("data-step-id");
    expect(firstStepId).toBeTruthy();
    await dialog3.getByTestId(`quality-step-move-down-${firstStepId}`).click();
    await expect(dialog3.getByLabel(/action/i).nth(0)).toHaveValue("Beta");
    await expect(dialog3.getByLabel(/action/i).nth(1)).toHaveValue("Alpha");
    await page.getByTestId("artifact-modal-save").click();
    await expect(dialog3).toBeHidden({ timeout: 15000 });

    await quality.openLeafEditFromTree(reorderId);
    const dialog4 = page.getByRole("dialog");
    await expect(dialog4.getByLabel(/action/i).nth(0)).toHaveValue("Beta");
    await expect(dialog4.getByLabel(/action/i).nth(1)).toHaveValue("Alpha");
    await page.getByTestId("artifact-modal-cancel").click();
  });
});

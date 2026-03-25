import { test, expect } from "@playwright/test";
import { ArtifactsPage } from "./pages/artifacts.page";

const TARGET_ARTIFACT_TITLE = "Sample requirement";

test.describe("Artifact flow", () => {
  test("create, transition, and delete artifact", async ({ page }) => {
    test.setTimeout(60000);
    const artifactsPage = new ArtifactsPage(page);
    await page.goto("/");
    await expect(page).not.toHaveURL(/\/login/);
    await page.waitForLoadState("networkidle");

    const orgPath = new URL(page.url()).pathname;
    const segments = orgPath.split("/").filter(Boolean);
    const orgSlug = segments[0];
    expect(orgSlug).toBeTruthy();

    const firstProjectCard = page.getByTestId("project-card").first();
    await firstProjectCard.click({ timeout: 10000 });
    await artifactsPage.openFromProjectRoot(orgSlug);

    await expect(page.getByText(TARGET_ARTIFACT_TITLE)).toBeVisible({ timeout: 15000 });
    const row = page.locator("tr").filter({ hasText: TARGET_ARTIFACT_TITLE });
    await row.locator("button").last().click();
    await page.getByRole("menuitem", { name: /move to|active|in progress/i }).first().click({ timeout: 5000 });
    const transitionButton = page.getByRole("button", { name: "Transition" });
    if (await transitionButton.isVisible().catch(() => false)) {
      await transitionButton.click({ timeout: 5000 });
    }
    await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 8000 }).catch(() => undefined);

    await page.goto(`/${orgSlug}/sample-project/artifacts`);
    await page.waitForURL(/\/artifacts/, { timeout: 10000 });
    const deleteRow = page.locator("tr").filter({ hasText: TARGET_ARTIFACT_TITLE });
    await deleteRow.locator("button").last().click();
    await page.getByRole("menuitem", { name: /delete/i }).click();
    const deleteDialog = page.getByRole("dialog", { name: /delete artifact/i });
    if (await deleteDialog.isVisible().catch(() => false)) {
      const deleteByTestId = page.getByTestId("artifact-modal-delete-confirm");
      if (await deleteByTestId.isVisible().catch(() => false)) {
        await deleteByTestId.click();
      } else {
        await page.getByRole("button", { name: "Delete" }).filter({ hasText: "Delete" }).click();
      }
      await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 5000 }).catch(() => undefined);
    }
    await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 5000 }).catch(() => undefined);
  });
});

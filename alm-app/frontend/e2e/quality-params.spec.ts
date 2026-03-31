import { test, expect } from "@playwright/test";
import { ProjectNavigationPage } from "./pages/projectNavigation.page";
import { QualityWorkspacePage } from "./pages/qualityWorkspace.page";

test.describe("Quality test-case parameters", () => {
  test("persists test_params_json with defs and dataset row", async ({ page }) => {
    test.setTimeout(120000);
    const nav = new ProjectNavigationPage(page);
    const quality = new QualityWorkspacePage(page);
    await nav.openProjectQuality();
    await quality.openCatalog();
    await quality.selectFirstQualityFolder();

    const base = Date.now();
    const title = `E2E Params ${base}`;
    const headerCreate = page.getByTestId("quality-create-button");
    const headerReady =
      (await headerCreate.isVisible().catch(() => false)) &&
      (await headerCreate.isEnabled().catch(() => false));
    if (headerReady) {
      await headerCreate.click();
    } else {
      await quality.clickCreateInQualityWorkspace();
    }

    await page.getByTestId("artifact-modal-title-input").waitFor({ state: "visible", timeout: 20000 });
    await page.getByTestId("artifact-modal-title-input").fill(title);

    const modal = page.getByTestId("quality-artifact-modal");
    await modal.getByTestId("quality-param-add-def").click();
    await modal.getByTestId("quality-param-name-0").fill("user");
    await modal.getByTestId("quality-param-default-0").fill("defaultUser");

    await modal.getByTestId("quality-param-add-row").click();
    await modal.getByTestId("quality-param-row-0-cell-user").fill("rowUser");

    await modal.getByTestId("step-add-button").click();
    await modal.getByLabel(/action/i).first().fill("Login as ${user}");

    await page.getByTestId("artifact-modal-create").click();
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 20000 });

    const artifactId = await quality.findQualityArtifactIdByTitle(title, "test-case");
    const parts = new URL(page.url()).pathname.split("/").filter(Boolean);
    const oi = parts.indexOf("orgs");
    const pi = parts.indexOf("projects");
    const orgSlug = parts[oi + 1];
    const projectSlug = parts[pi + 1];
    expect(orgSlug && projectSlug).toBeTruthy();
    const res = await page.request.get(
      `/api/v1/orgs/${orgSlug}/projects/${projectSlug}/artifacts/${artifactId}`,
    );
    expect(res.ok()).toBeTruthy();
    const data = (await res.json()) as { custom_fields?: Record<string, unknown> };
    const tp = data.custom_fields?.test_params_json as {
      defs?: Array<{ name: string }>;
      rows?: Array<{ values: Record<string, string> }>;
    };
    expect(tp?.defs?.some((d) => d.name === "user")).toBeTruthy();
    expect(tp?.rows?.[0]?.values?.user).toBe("rowUser");
  });
});

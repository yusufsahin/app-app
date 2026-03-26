import { test, expect } from "@playwright/test";

const DEMO_ORG = "demo";
const DEMO_PROJECT = "sample-project";

test.describe("Planning release and iteration", () => {
  test("add release then iteration under it", async ({ page }) => {
    test.setTimeout(45000);
    await page.goto("/");
    await expect(page).not.toHaveURL(/\/login/);
    await page.waitForLoadState("networkidle");

    await page.goto(`/${DEMO_ORG}/${DEMO_PROJECT}/planning`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: /Planning/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: /Add release/i })).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: /Add release/i }).click();
    await expect(page.getByRole("heading", { name: "Add release" })).toBeVisible({ timeout: 5000 });
    await page.getByLabel(/name/i).fill("E2E Release 1");
    await page.getByRole("button", { name: "Add" }).click();

    await expect(page.getByText("E2E Release 1")).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("Release", { exact: false }).first()).toBeVisible({ timeout: 3000 });

    await page.getByRole("button", { name: /Add iteration/i }).first().click();
    await expect(page.getByRole("heading", { name: "Add iteration" })).toBeVisible({ timeout: 5000 });
    await page.getByLabel(/name/i).fill("Sprint 1");
    await page.getByRole("button", { name: "Add" }).click();

    await expect(page.getByText("Sprint 1")).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("E2E Release 1")).toBeVisible();
  });
});
